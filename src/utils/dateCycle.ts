import { CycleConfig, CyclePreset } from '../types/ot';

export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export const THAI_WEEKDAYS_SUN = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const THAI_WEEKDAYS_MON = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateKey(year: number, month1to12: number, day: number): string {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function getTodayKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function clampDay(year: number, month1to12: number, day: number): number {
  const max = daysInMonth(year, month1to12);
  return Math.max(1, Math.min(day, max));
}

export function shiftMonth(year: number, month1to12: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month1to12 - 1) + delta;
  const newYear = Math.floor(idx / 12);
  const newMonth = ((idx % 12) + 12) % 12 + 1;
  return { year: newYear, month: newMonth };
}

export function getCyclePresetConfig(preset: CyclePreset): CycleConfig {
  if (preset === '1-15_16-eom') {
    return {
      preset: '1-15_16-eom',
      cycle1: {
        startDay: 1,
        startFromPrevMonth: false,
        endDay: 15,
      },
      cycle2: {
        startDay: 16,
        endDay: 31,
        endAtMonthEnd: true,
      },
    };
  }
  return {
    preset: preset === 'custom' ? 'custom' : '29-13_14-28',
    cycle1: {
      startDay: 29,
      startFromPrevMonth: true,
      endDay: 13,
    },
    cycle2: {
      startDay: 14,
      endDay: 28,
      endAtMonthEnd: false,
    },
  };
}

export interface CycleDateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export function getCycleRangesForMonth(
  year: number,
  month1to12: number,
  cycles: CycleConfig
): { cycle1: CycleDateRange; cycle2: CycleDateRange } {
  let c1StartDate: string;
  if (cycles.cycle1.startFromPrevMonth) {
    const prev = shiftMonth(year, month1to12, -1);
    const prevMax = daysInMonth(prev.year, prev.month);
    if (cycles.cycle1.startDay > prevMax) {
      // Previous month doesn't have this start day (e.g., Feb has 28 days while cycle1 starts on 29th)
      // Start on the 1st of current month to avoid overlapping Feb's cycle 2
      c1StartDate = toDateKey(year, month1to12, 1);
    } else {
      c1StartDate = toDateKey(prev.year, prev.month, cycles.cycle1.startDay);
    }
  } else {
    c1StartDate = toDateKey(year, month1to12, clampDay(year, month1to12, cycles.cycle1.startDay));
  }

  const c1EndDay = clampDay(year, month1to12, cycles.cycle1.endDay);
  const c1EndDate = toDateKey(year, month1to12, c1EndDay);

  const c2StartDay = clampDay(year, month1to12, cycles.cycle2.startDay);
  const c2StartDate = toDateKey(year, month1to12, c2StartDay);

  const c2EndDay = cycles.cycle2.endAtMonthEnd
    ? daysInMonth(year, month1to12)
    : clampDay(year, month1to12, cycles.cycle2.endDay);
  const c2EndDate = toDateKey(year, month1to12, c2EndDay);

  return {
    cycle1: {
      startDate: c1StartDate,
      endDate: c1EndDate,
      label: `${formatThaiShortDate(c1StartDate)} – ${formatThaiShortDate(c1EndDate)}`,
    },
    cycle2: {
      startDate: c2StartDate,
      endDate: c2EndDate,
      label: `${formatThaiShortDate(c2StartDate)} – ${formatThaiShortDate(c2EndDate)}`,
    },
  };
}

export function isDateInRange(dateKey: string, startDate: string, endDate: string): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

export function whichCycleInMonth(
  dateKey: string,
  year: number,
  month1to12: number,
  cycles: CycleConfig
): 1 | 2 | null {
  const ranges = getCycleRangesForMonth(year, month1to12, cycles);
  if (isDateInRange(dateKey, ranges.cycle1.startDate, ranges.cycle1.endDate)) return 1;
  if (isDateInRange(dateKey, ranges.cycle2.startDate, ranges.cycle2.endDate)) return 2;
  return null;
}

export function enumerateDatesInRange(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  if (startDate > endDate) return result;
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const cursor = new Date(start.year, start.month - 1, start.day);
  const endDt = new Date(end.year, end.month - 1, end.day);
  while (cursor <= endDt) {
    result.push(toDateKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function formatThaiShortDate(dateKey: string): string {
  const { day, month } = parseDateKey(dateKey);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]}`;
}

export function formatThaiFullDate(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  const dt = new Date(year, month - 1, day);
  const weekday = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][dt.getDay()];
  return `วัน${weekday}ที่ ${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}

export function formatThaiMonthYear(year: number, month1to12: number): string {
  return `${THAI_MONTHS[month1to12 - 1]} ${year + 543} (${year})`;
}

export function getMonthKey(year: number, month1to12: number): string {
  return `${year}-${pad2(month1to12)}`;
}
