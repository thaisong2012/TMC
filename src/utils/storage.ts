import { AppDataState, AppSettings, DayRecord } from '../types/ot';
import { calculateDayTotals, calculateEntryPay } from './calculations';
import { formatThaiFullDate, getCyclePresetConfig, pad2 } from './dateCycle';

const STORAGE_KEY = 'ot_wage_ledger_data_v1';
const THEME_KEY = 'ot_wage_ledger_theme_v1';

export function getDefaultSettings(): AppSettings {
  return {
    defaultOtRate: 46.5,
    defaultDailyWage: 372,
    standardHoursPerDay: 8,
    monthlyIncomeGoal: 18000,
    monthlyOtHoursGoal: 60,
    enableSsoDeduction: false,
    ssoMaxCap: 750,
    weekStartsOnMonday: false,
    cycles: getCyclePresetConfig('29-13_14-28'),
  };
}

export function getInitialAppState(): AppDataState {
  return {
    version: 1,
    settings: getDefaultSettings(),
    days: {},
    adjustments: [],
  };
}

export function loadAppState(): AppDataState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialAppState();
    const parsed = JSON.parse(raw) as Partial<AppDataState>;
    const defaults = getDefaultSettings();
    return {
      version: 1,
      settings: {
        ...defaults,
        ...(parsed.settings || {}),
        cycles: parsed.settings?.cycles || defaults.cycles,
      },
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
      adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
    };
  } catch {
    return getInitialAppState();
  }
}

export function saveAppState(state: AppDataState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportRecordsToExcelCsv(
  daysMap: Record<string, DayRecord>,
  year?: number,
  month1to12?: number
): void {
  const sortedKeys = Object.keys(daysMap)
    .filter((k) => {
      if (!year) return true;
      if (!month1to12) return k.startsWith(`${year}-`);
      return k.startsWith(`${year}-${pad2(month1to12)}-`);
    })
    .sort();

  const headers = [
    'วันที่ (YYYY-MM-DD)',
    'วัน/เดือน/ปี (ไทย)',
    'ประเภทวัน',
    'ค่าแรงรายวัน (บาท)',
    'ชั่วโมง OT',
    'ตัวคูณเรท',
    'เรทฐาน OT (บาท/ชม.)',
    'ค่า OT รายการ (บาท)',
    'รวมค่าแรง + OT วันนั้น (บาท)',
    'หมายเหตุ',
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const key of sortedKeys) {
    const day = daysMap[key];
    const totals = calculateDayTotals(day);
    const typeLabel =
      day.workdayType === 'workday'
        ? 'วันทำงานปกติ'
        : day.workdayType === 'holiday_ot'
          ? 'วันหยุด (ทำ OT)'
          : 'วันหยุด / วันลา';

    if (day.entries.length === 0) {
      if (totals.baseWage > 0 || day.dayNote) {
        rows.push(
          [
            day.date,
            formatThaiFullDate(day.date),
            typeLabel,
            totals.baseWage.toFixed(2),
            '0',
            '-',
            '-',
            '0.00',
            totals.totalPay.toFixed(2),
            day.dayNote || '',
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }
    } else {
      day.entries.forEach((entry, idx) => {
        const entryPay = calculateEntryPay(entry);
        rows.push(
          [
            day.date,
            formatThaiFullDate(day.date),
            typeLabel,
            idx === 0 ? totals.baseWage.toFixed(2) : '0.00',
            entry.hours,
            `${entry.multiplier}x`,
            entry.ratePerHour.toFixed(2),
            entryPay.toFixed(2),
            idx === 0 ? totals.totalPay.toFixed(2) : '',
            entry.note || (idx === 0 ? day.dayNote || '' : ''),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      });
    }
  }

  // UTF-8 BOM (\uFEFF) guarantees Thai characters render cleanly in Microsoft Excel
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const suffix = year ? (month1to12 ? `${year}-${pad2(month1to12)}` : `${year}`) : 'all';
  link.href = url;
  link.download = `ot-wage-report-${suffix}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJsonBackup(state: AppDataState): void {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ot-wage-backup-${today}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseAndValidateBackupJson(jsonText: string): AppDataState {
  const parsed = JSON.parse(jsonText) as Partial<AppDataState>;
  if (!parsed || typeof parsed !== 'object' || !parsed.days || !parsed.settings) {
    throw new Error('ไฟล์ JSON ไม่ถูกต้อง หรือไม่ใช่ไฟล์สำรองของระบบบันทึก OT');
  }
  const defaults = getDefaultSettings();
  return {
    version: 1,
    settings: {
      ...defaults,
      ...parsed.settings,
      cycles: parsed.settings.cycles || defaults.cycles,
    },
    days: parsed.days,
    adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
  };
}
