import {
  AdjustmentItem,
  AppSettings,
  DayRecord,
  OtEntry,
  SummaryMetrics,
} from '../types/ot';
import {
  daysInMonth,
  enumerateDatesInRange,
  getCycleRangesForMonth,
  getMonthKey,
  THAI_MONTHS_SHORT,
  toDateKey,
} from './dateCycle';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatBaht(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatHours(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function calculateEntryPay(entry: OtEntry): number {
  return round2(entry.hours * entry.multiplier * entry.ratePerHour);
}

export function calculateDayTotals(day?: DayRecord): {
  baseWage: number;
  otHours: number;
  otPay: number;
  totalPay: number;
  byMultiplier: Record<string, { hours: number; pay: number }>;
} {
  if (!day) {
    return { baseWage: 0, otHours: 0, otPay: 0, totalPay: 0, byMultiplier: {} };
  }
  const baseWage = day.includeDailyWage && day.workdayType !== 'day_off' ? round2(day.dailyWage) : 0;
  let otHours = 0;
  let otPay = 0;
  const byMultiplier: Record<string, { hours: number; pay: number }> = {};

  for (const entry of day.entries) {
    const pay = calculateEntryPay(entry);
    otHours = round2(otHours + entry.hours);
    otPay = round2(otPay + pay);
    const multKey = `${entry.multiplier}x`;
    if (!byMultiplier[multKey]) {
      byMultiplier[multKey] = { hours: 0, pay: 0 };
    }
    byMultiplier[multKey].hours = round2(byMultiplier[multKey].hours + entry.hours);
    byMultiplier[multKey].pay = round2(byMultiplier[multKey].pay + pay);
  }

  return {
    baseWage,
    otHours,
    otPay,
    totalPay: round2(baseWage + otPay),
    byMultiplier,
  };
}

export function summarizeDateRange(
  daysMap: Record<string, DayRecord>,
  startDate: string,
  endDate: string,
  adjustments: AdjustmentItem[] = [],
  settings?: AppSettings,
  monthKey?: string,
  cycleFilter?: 1 | 2
): SummaryMetrics {
  const dates = enumerateDatesInRange(startDate, endDate);
  let workdays = 0;
  let otDays = 0;
  let otHours = 0;
  let baseWageTotal = 0;
  let otPayTotal = 0;
  const byMultiplier: Record<string, { hours: number; pay: number }> = {};

  for (const dKey of dates) {
    const day = daysMap[dKey];
    if (!day) continue;
    const totals = calculateDayTotals(day);
    if (day.workdayType === 'workday' && day.includeDailyWage) {
      workdays += 1;
    } else if (day.workdayType === 'holiday_ot' && totals.otHours > 0) {
      // Counts as an extra OT workday even if base daily wage is toggled off
    }
    if (totals.otHours > 0) {
      otDays += 1;
    }
    baseWageTotal = round2(baseWageTotal + totals.baseWage);
    otHours = round2(otHours + totals.otHours);
    otPayTotal = round2(otPayTotal + totals.otPay);

    for (const [k, val] of Object.entries(totals.byMultiplier)) {
      if (!byMultiplier[k]) byMultiplier[k] = { hours: 0, pay: 0 };
      byMultiplier[k].hours = round2(byMultiplier[k].hours + val.hours);
      byMultiplier[k].pay = round2(byMultiplier[k].pay + val.pay);
    }
  }

  let allowanceTotal = 0;
  let deductionTotal = 0;
  if (monthKey) {
    for (const adj of adjustments) {
      if (adj.monthKey !== monthKey) continue;
      if (cycleFilter && adj.cycle !== cycleFilter) continue;
      if (adj.type === 'allowance') {
        allowanceTotal = round2(allowanceTotal + adj.amount);
      } else {
        deductionTotal = round2(deductionTotal + adj.amount);
      }
    }
  }

  const grossPay = round2(baseWageTotal + otPayTotal + allowanceTotal);

  let ssoDeduction = 0;
  if (settings?.enableSsoDeduction && baseWageTotal > 0) {
    const cap = cycleFilter ? round2(settings.ssoMaxCap / 2) : settings.ssoMaxCap;
    ssoDeduction = Math.min(round2(baseWageTotal * 0.05), cap);
  }

  const netPay = round2(grossPay - deductionTotal - ssoDeduction);

  return {
    startDate,
    endDate,
    totalDays: dates.length,
    workdays,
    otDays,
    otHours,
    baseWageTotal,
    otPayTotal,
    allowanceTotal,
    deductionTotal,
    ssoDeduction,
    grossPay,
    netPay,
    byMultiplier,
  };
}

export function summarizeCyclePayMonth(
  daysMap: Record<string, DayRecord>,
  year: number,
  month1to12: number,
  adjustments: AdjustmentItem[],
  settings: AppSettings
): {
  cycle1: SummaryMetrics;
  cycle2: SummaryMetrics;
  combined: SummaryMetrics;
} {
  const ranges = getCycleRangesForMonth(year, month1to12, settings.cycles);
  const mKey = getMonthKey(year, month1to12);
  const cycle1 = summarizeDateRange(
    daysMap,
    ranges.cycle1.startDate,
    ranges.cycle1.endDate,
    adjustments,
    settings,
    mKey,
    1
  );
  const cycle2 = summarizeDateRange(
    daysMap,
    ranges.cycle2.startDate,
    ranges.cycle2.endDate,
    adjustments,
    settings,
    mKey,
    2
  );

  const byMultiplier: Record<string, { hours: number; pay: number }> = {};
  for (const src of [cycle1.byMultiplier, cycle2.byMultiplier]) {
    for (const [k, val] of Object.entries(src)) {
      if (!byMultiplier[k]) byMultiplier[k] = { hours: 0, pay: 0 };
      byMultiplier[k].hours = round2(byMultiplier[k].hours + val.hours);
      byMultiplier[k].pay = round2(byMultiplier[k].pay + val.pay);
    }
  }

  const baseWageTotal = round2(cycle1.baseWageTotal + cycle2.baseWageTotal);
  const otPayTotal = round2(cycle1.otPayTotal + cycle2.otPayTotal);
  const allowanceTotal = round2(cycle1.allowanceTotal + cycle2.allowanceTotal);
  const deductionTotal = round2(cycle1.deductionTotal + cycle2.deductionTotal);
  const ssoDeduction = settings.enableSsoDeduction && baseWageTotal > 0
    ? Math.min(round2(baseWageTotal * 0.05), settings.ssoMaxCap)
    : 0;
  const grossPay = round2(baseWageTotal + otPayTotal + allowanceTotal);
  const netPay = round2(grossPay - deductionTotal - ssoDeduction);

  const combined: SummaryMetrics = {
    startDate: ranges.cycle1.startDate,
    endDate: ranges.cycle2.endDate,
    totalDays: cycle1.totalDays + cycle2.totalDays,
    workdays: cycle1.workdays + cycle2.workdays,
    otDays: cycle1.otDays + cycle2.otDays,
    otHours: round2(cycle1.otHours + cycle2.otHours),
    baseWageTotal,
    otPayTotal,
    allowanceTotal,
    deductionTotal,
    ssoDeduction,
    grossPay,
    netPay,
    byMultiplier,
  };

  return { cycle1, cycle2, combined };
}

export function summarizeCalendarMonth(
  daysMap: Record<string, DayRecord>,
  year: number,
  month1to12: number,
  adjustments: AdjustmentItem[],
  settings: AppSettings
): SummaryMetrics {
  const startDate = toDateKey(year, month1to12, 1);
  const endDate = toDateKey(year, month1to12, daysInMonth(year, month1to12));
  const mKey = getMonthKey(year, month1to12);
  return summarizeDateRange(daysMap, startDate, endDate, adjustments, settings, mKey);
}

export interface MonthlyChartDatum {
  month: number;
  label: string;
  baseWage: number;
  otPay: number;
  allowance: number;
  deduction: number;
  netPay: number;
  otHours: number;
  workdays: number;
}

export function summarizeYear(
  daysMap: Record<string, DayRecord>,
  year: number,
  adjustments: AdjustmentItem[],
  settings: AppSettings,
  mode: 'pay_cycles' | 'calendar' = 'pay_cycles'
): {
  months: MonthlyChartDatum[];
  totalWorkdays: number;
  totalOtHours: number;
  totalBaseWage: number;
  totalOtPay: number;
  totalAllowance: number;
  totalDeduction: number;
  totalNetPay: number;
  avgMonthlyNet: number;
} {
  const months: MonthlyChartDatum[] = [];
  let totalWorkdays = 0;
  let totalOtHours = 0;
  let totalBaseWage = 0;
  let totalOtPay = 0;
  let totalAllowance = 0;
  let totalDeduction = 0;
  let totalNetPay = 0;
  let activeMonths = 0;

  for (let m = 1; m <= 12; m++) {
    const summary =
      mode === 'pay_cycles'
        ? summarizeCyclePayMonth(daysMap, year, m, adjustments, settings).combined
        : summarizeCalendarMonth(daysMap, year, m, adjustments, settings);

    if (summary.grossPay > 0 || summary.otHours > 0) {
      activeMonths += 1;
    }

    months.push({
      month: m,
      label: THAI_MONTHS_SHORT[m - 1],
      baseWage: summary.baseWageTotal,
      otPay: summary.otPayTotal,
      allowance: summary.allowanceTotal,
      deduction: round2(summary.deductionTotal + summary.ssoDeduction),
      netPay: summary.netPay,
      otHours: summary.otHours,
      workdays: summary.workdays,
    });

    totalWorkdays += summary.workdays;
    totalOtHours = round2(totalOtHours + summary.otHours);
    totalBaseWage = round2(totalBaseWage + summary.baseWageTotal);
    totalOtPay = round2(totalOtPay + summary.otPayTotal);
    totalAllowance = round2(totalAllowance + summary.allowanceTotal);
    totalDeduction = round2(totalDeduction + summary.deductionTotal + summary.ssoDeduction);
    totalNetPay = round2(totalNetPay + summary.netPay);
  }

  return {
    months,
    totalWorkdays,
    totalOtHours,
    totalBaseWage,
    totalOtPay,
    totalAllowance,
    totalDeduction,
    totalNetPay,
    avgMonthlyNet: activeMonths > 0 ? round2(totalNetPay / activeMonths) : 0,
  };
}
