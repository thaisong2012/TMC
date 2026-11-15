import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppDataState } from '../types/ot';
import {
  calculateDayTotals,
  calculateEntryPay,
  summarizeCyclePayMonth,
  summarizeYear,
} from '../utils/calculations';
import {
  formatThaiFullDate,
  formatThaiMonthYear,
  getCycleRangesForMonth,
  THAI_MONTHS,
} from '../utils/dateCycle';
import { parseAndValidateBackupJson } from '../utils/storage';

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่สามารถรับสิทธิ์เข้าถึง Google Sheets และ Drive ได้ กรุณาลองใหม่อีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => cachedAccessToken;

export const signOutGoogleWorkspace = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

async function googleFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) {
    const errText = await res.text();
    let msg = `Google API Error (${res.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

const TAB_DAILY = 'รายการโอทีรายวัน';
const TAB_CYCLES = 'สรุปรอบตัดวีค';
const TAB_ANNUAL = 'สรุปรายปี_12_เดือน';

function buildSpreadsheetPayloads(state: AppDataState, activeYear: number) {
  const dailyRows: (string | number)[][] = [
    [
      'วันที่',
      'วัน/เดือน/ปี (ไทย)',
      'ประเภทวัน',
      'ค่าแรงรายวัน (บาท)',
      'ชั่วโมง OT',
      'ตัวคูณ',
      'เรทฐาน OT (บาท/ชม.)',
      'ค่า OT (บาท)',
      'รวมทั้งวัน (บาท)',
      'หมายเหตุ',
    ],
  ];

  const sortedDates = Object.keys(state.days).sort();
  for (const dateKey of sortedDates) {
    const day = state.days[dateKey];
    const totals = calculateDayTotals(day);
    const typeLabel =
      day.workdayType === 'workday'
        ? 'วันทำงานปกติ'
        : day.workdayType === 'holiday_ot'
          ? 'วันหยุด (ทำ OT)'
          : 'วันหยุด / วันลา';

    if (day.entries.length === 0) {
      if (totals.baseWage > 0 || day.dayNote) {
        dailyRows.push([
          day.date,
          formatThaiFullDate(day.date),
          typeLabel,
          totals.baseWage,
          0,
          '-',
          '-',
          0,
          totals.totalPay,
          day.dayNote || '',
        ]);
      }
    } else {
      day.entries.forEach((entry, idx) => {
        dailyRows.push([
          day.date,
          formatThaiFullDate(day.date),
          typeLabel,
          idx === 0 ? totals.baseWage : 0,
          entry.hours,
          `${entry.multiplier}x`,
          entry.ratePerHour,
          calculateEntryPay(entry),
          idx === 0 ? totals.totalPay : '',
          entry.note || (idx === 0 ? day.dayNote || '' : ''),
        ]);
      });
    }
  }

  const cycleRows: (string | number)[][] = [
    [
      'เดือน (พ.ศ./ค.ศ.)',
      'รอบตัดวีค',
      'ช่วงวันที่',
      'วันทำงาน',
      'ชั่วโมง OT',
      'ค่าแรงพื้นฐาน (บาท)',
      'ค่า OT (บาท)',
      'เบี้ยขยัน/เพิ่ม (บาท)',
      'หัก/ประกันสังคม (บาท)',
      'ยอดสุทธิ (บาท)',
    ],
  ];

  for (let m = 1; m <= 12; m++) {
    const ranges = getCycleRangesForMonth(activeYear, m, state.settings.cycles);
    const summary = summarizeCyclePayMonth(
      state.days,
      activeYear,
      m,
      state.adjustments,
      state.settings
    );
    const monthLabel = formatThaiMonthYear(activeYear, m);
    cycleRows.push([
      monthLabel,
      'รอบที่ 1',
      ranges.cycle1.label,
      summary.cycle1.workdays,
      summary.cycle1.otHours,
      summary.cycle1.baseWageTotal,
      summary.cycle1.otPayTotal,
      summary.cycle1.allowanceTotal,
      summary.cycle1.deductionTotal + summary.cycle1.ssoDeduction,
      summary.cycle1.netPay,
    ]);
    cycleRows.push([
      monthLabel,
      'รอบที่ 2',
      ranges.cycle2.label,
      summary.cycle2.workdays,
      summary.cycle2.otHours,
      summary.cycle2.baseWageTotal,
      summary.cycle2.otPayTotal,
      summary.cycle2.allowanceTotal,
      summary.cycle2.deductionTotal + summary.cycle2.ssoDeduction,
      summary.cycle2.netPay,
    ]);
  }

  const yearSummary = summarizeYear(
    state.days,
    activeYear,
    state.adjustments,
    state.settings,
    'pay_cycles'
  );
  const annualRows: (string | number)[][] = [
    [
      `สรุปรายได้ปี ${activeYear + 543} (${activeYear})`,
      'วันทำงาน',
      'ชั่วโมง OT',
      'ค่าแรงพื้นฐาน (บาท)',
      'ค่า OT (บาท)',
      'เบี้ยขยัน/เพิ่ม (บาท)',
      'หัก/ประกันสังคม (บาท)',
      'รายได้สุทธิ (บาท)',
    ],
  ];

  yearSummary.months.forEach((m) => {
    annualRows.push([
      THAI_MONTHS[m.month - 1],
      m.workdays,
      m.otHours,
      m.baseWage,
      m.otPay,
      m.allowance,
      m.deduction,
      m.netPay,
    ]);
  });

  annualRows.push([
    'รวมทั้งปี',
    yearSummary.totalWorkdays,
    yearSummary.totalOtHours,
    yearSummary.totalBaseWage,
    yearSummary.totalOtPay,
    yearSummary.totalAllowance,
    yearSummary.totalDeduction,
    yearSummary.totalNetPay,
  ]);

  return { dailyRows, cycleRows, annualRows };
}

export async function createAndSyncSpreadsheet(
  token: string,
  state: AppDataState,
  activeYear: number
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const title = `OT & Wage Ledger - ${activeYear + 543} (${activeYear})`;
  const created = await googleFetch('https://sheets.googleapis.com/v4/spreadsheets', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title, locale: 'th_TH' },
      sheets: [
        { properties: { title: TAB_DAILY } },
        { properties: { title: TAB_CYCLES } },
        { properties: { title: TAB_ANNUAL } },
      ],
    }),
  });

  const spreadsheetId = created.spreadsheetId as string;
  const spreadsheetUrl = created.spreadsheetUrl as string;

  await writeTabsToSpreadsheet(token, spreadsheetId, state, activeYear);

  return { spreadsheetId, spreadsheetUrl, title };
}

async function ensureRequiredTabsExist(token: string, spreadsheetId: string) {
  const meta = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`,
    token
  );
  const existingTitles = new Set<string>(
    (meta.sheets || []).map((s: { properties: { title: string } }) => s.properties.title)
  );
  const requiredTabs = [TAB_DAILY, TAB_CYCLES, TAB_ANNUAL];
  const requests = requiredTabs
    .filter((tab) => !existingTitles.has(tab))
    .map((tab) => ({
      addSheet: {
        properties: { title: tab },
      },
    }));

  if (requests.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
  }
  return meta.properties?.title as string;
}

async function writeTabsToSpreadsheet(
  token: string,
  spreadsheetId: string,
  state: AppDataState,
  activeYear: number
) {
  const { dailyRows, cycleRows, annualRows } = buildSpreadsheetPayloads(state, activeYear);

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [`'${TAB_DAILY}'!A:Z`, `'${TAB_CYCLES}'!A:Z`, `'${TAB_ANNUAL}'!A:Z`],
      }),
    }
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${TAB_DAILY}'!A1`, values: dailyRows },
          { range: `'${TAB_CYCLES}'!A1`, values: cycleRows },
          { range: `'${TAB_ANNUAL}'!A1`, values: annualRows },
        ],
      }),
    }
  );
}

export async function syncExistingSpreadsheet(
  token: string,
  spreadsheetId: string,
  state: AppDataState,
  activeYear: number
): Promise<{ title: string }> {
  const title = await ensureRequiredTabsExist(token, spreadsheetId);
  await writeTabsToSpreadsheet(token, spreadsheetId, state, activeYear);
  return { title };
}

export async function listAppDriveFiles(token: string): Promise<DriveFileItem[]> {
  const q = encodeURIComponent(
    "trashed = false and (mimeType = 'application/json' or mimeType = 'application/vnd.google-apps.spreadsheet')"
  );
  const fields = encodeURIComponent(
    'files(id, name, mimeType, modifiedTime, size, webViewLink)'
  );
  const data = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=25&fields=${fields}`,
    token
  );
  return (data.files || []) as DriveFileItem[];
}

export async function uploadJsonBackupToDrive(
  token: string,
  state: AppDataState,
  existingFileId?: string
): Promise<DriveFileItem> {
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `ot-wage-backup-${today}.json`;
  const metadata = existingFileId
    ? { name: fileName, mimeType: 'application/json' }
    : {
        name: fileName,
        mimeType: 'application/json',
        description: 'OT & Wage Ledger JSON Backup',
      };

  const boundary = `ot_ledger_boundary_${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(state, null, 2)}\r\n` +
    `--${boundary}--`;

  const endpoint = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink`;

  return (await googleFetch(endpoint, token, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })) as DriveFileItem;
}

export async function restoreBackupFromDrive(
  token: string,
  fileId: string
): Promise<AppDataState> {
  const raw = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    token
  );
  const jsonText = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return parseAndValidateBackupJson(jsonText);
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  await googleFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, token, {
    method: 'DELETE',
  });
}
