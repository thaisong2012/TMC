export type WorkdayType = 'workday' | 'holiday_ot' | 'day_off';

export interface OtEntry {
  id: string;
  hours: number;
  multiplier: number;
  ratePerHour: number;
  note: string;
  createdAt: string;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  workdayType: WorkdayType;
  dailyWage: number;
  includeDailyWage: boolean;
  entries: OtEntry[];
  dayNote?: string;
}

export type CyclePreset = '29-13_14-28' | '1-15_16-eom' | 'custom';

export interface CycleConfig {
  preset: CyclePreset;
  cycle1: {
    startDay: number;
    startFromPrevMonth: boolean;
    endDay: number;
  };
  cycle2: {
    startDay: number;
    endDay: number;
    endAtMonthEnd: boolean;
  };
}

export interface AdjustmentItem {
  id: string;
  monthKey: string; // YYYY-MM
  cycle: 1 | 2;
  type: 'allowance' | 'deduction';
  label: string;
  amount: number;
}

export interface AppSettings {
  defaultOtRate: number;
  defaultDailyWage: number;
  standardHoursPerDay: number;
  monthlyIncomeGoal: number;
  monthlyOtHoursGoal: number;
  enableSsoDeduction: boolean;
  ssoMaxCap: number;
  weekStartsOnMonday: boolean;
  cycles: CycleConfig;
  googleSheetId?: string;
  googleSheetUrl?: string;
  googleSheetName?: string;
  lastGoogleSyncAt?: string;
}

export interface AppDataState {
  version: number;
  settings: AppSettings;
  days: Record<string, DayRecord>;
  adjustments: AdjustmentItem[];
}

export interface SummaryMetrics {
  startDate: string;
  endDate: string;
  totalDays: number;
  workdays: number;
  otDays: number;
  otHours: number;
  baseWageTotal: number;
  otPayTotal: number;
  allowanceTotal: number;
  deductionTotal: number;
  ssoDeduction: number;
  grossPay: number;
  netPay: number;
  byMultiplier: Record<string, { hours: number; pay: number }>;
}

export type ActiveTab = 'dashboard' | 'calendar' | 'analytics' | 'sync' | 'settings';
