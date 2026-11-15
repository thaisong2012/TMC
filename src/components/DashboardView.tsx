import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { AdjustmentItem, AppSettings, DayRecord } from '../types/ot';
import {
  calculateDayTotals,
  formatBaht,
  formatHours,
  summarizeCalendarMonth,
  summarizeCyclePayMonth,
  summarizeYear,
} from '../utils/calculations';
import {
  formatThaiMonthYear,
  formatThaiShortDate,
  getCycleRangesForMonth,
  getMonthKey,
  getTodayKey,
  shiftMonth,
} from '../utils/dateCycle';
import { generateId } from '../utils/storage';
import { AnnualBarChart } from './AnnualBarChart';

interface DashboardViewProps {
  year: number;
  month: number;
  daysMap: Record<string, DayRecord>;
  adjustments: AdjustmentItem[];
  settings: AppSettings;
  onChangeMonth: (year: number, month: number) => void;
  onQuickLogDate: (dateKey: string) => void;
  onAddAdjustment: (item: AdjustmentItem) => void;
  onDeleteAdjustment: (id: string) => void;
  onNavigateCalendar: (dateKey: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  year,
  month,
  daysMap,
  adjustments,
  settings,
  onChangeMonth,
  onQuickLogDate,
  onAddAdjustment,
  onDeleteAdjustment,
  onNavigateCalendar,
}) => {
  const [summaryBasis, setSummaryBasis] = useState<'pay_cycles' | 'calendar'>('pay_cycles');
  const [adjCycle, setAdjCycle] = useState<1 | 2>(1);
  const [adjType, setAdjType] = useState<'allowance' | 'deduction'>('allowance');
  const [adjLabel, setAdjLabel] = useState('');
  const [adjAmount, setAdjAmount] = useState('');

  const todayKey = getTodayKey();
  const todayTotals = calculateDayTotals(daysMap[todayKey]);

  const cycleRanges = useMemo(
    () => getCycleRangesForMonth(year, month, settings.cycles),
    [year, month, settings.cycles]
  );

  const cycleSummary = useMemo(
    () => summarizeCyclePayMonth(daysMap, year, month, adjustments, settings),
    [daysMap, year, month, adjustments, settings]
  );

  const calendarSummary = useMemo(
    () => summarizeCalendarMonth(daysMap, year, month, adjustments, settings),
    [daysMap, year, month, adjustments, settings]
  );

  const activeMonthSummary =
    summaryBasis === 'pay_cycles' ? cycleSummary.combined : calendarSummary;

  const yearSummary = useMemo(
    () => summarizeYear(daysMap, year, adjustments, settings, summaryBasis),
    [daysMap, year, adjustments, settings, summaryBasis]
  );

  const monthKey = getMonthKey(year, month);
  const monthAdjustments = useMemo(
    () => adjustments.filter((a) => a.monthKey === monthKey),
    [adjustments, monthKey]
  );

  const incomeGoalPct =
    settings.monthlyIncomeGoal > 0
      ? Math.min(100, Math.round((activeMonthSummary.netPay / settings.monthlyIncomeGoal) * 100))
      : 0;
  const otHoursGoalPct =
    settings.monthlyOtHoursGoal > 0
      ? Math.min(100, Math.round((activeMonthSummary.otHours / settings.monthlyOtHoursGoal) * 100))
      : 0;

  const remainingIncome = Math.max(0, settings.monthlyIncomeGoal - activeMonthSummary.netPay);
  const suggestedOt15Hours =
    settings.defaultOtRate > 0
      ? remainingIncome / (settings.defaultOtRate * 1.5)
      : 0;

  const recentEntries = useMemo(() => {
    const start = activeMonthSummary.startDate;
    const end = activeMonthSummary.endDate;
    return Object.values(daysMap)
      .filter((d) => d.date >= start && d.date <= end && (d.entries.length > 0 || d.includeDailyWage))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [daysMap, activeMonthSummary.startDate, activeMonthSummary.endDate]);

  const handleCreateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(adjAmount);
    if (!adjLabel.trim() || isNaN(num) || num <= 0) return;
    onAddAdjustment({
      id: generateId(),
      monthKey,
      cycle: adjCycle,
      type: adjType,
      label: adjLabel.trim(),
      amount: num,
    });
    setAdjLabel('');
    setAdjAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Month & Basis Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const prev = shiftMonth(year, month, -1);
              onChangeMonth(prev.year, prev.month);
            }}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="เดือนก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatThaiMonthYear(year, month)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              เรทเริ่มต้น ฿{settings.defaultDailyWage}/วัน · OT ฿{settings.defaultOtRate}/ชม.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = shiftMonth(year, month, 1);
              onChangeMonth(next.year, next.month);
            }}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="เดือนถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setSummaryBasis('pay_cycles')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              summaryBasis === 'pay_cycles'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ตามรอบตัดวีค (2 รอบ)
          </button>
          <button
            type="button"
            onClick={() => setSummaryBasis('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              summaryBasis === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ตามเดือนปฏิทิน (1–สิ้นเดือน)
          </button>
        </div>
      </div>

      {/* Primary 4-Column KPI Strip: Daily / Cycle 1 / Cycle 2 / Monthly */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Today */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>สรุปรายวัน (วันนี้)</span>
              <span className="font-mono tabular-nums">{formatThaiShortDate(todayKey)}</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ฿{formatBaht(todayTotals.totalPay)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              OT {formatHours(todayTotals.otHours)} ชม. · แรง ฿{formatBaht(todayTotals.baseWage)}
            </span>
            <button
              type="button"
              onClick={() => onQuickLogDate(todayKey)}
              className="font-medium text-teal-600 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              บันทึกวันนี้
            </button>
          </div>
        </div>

        {/* 2. Cycle 1 */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-teal-700 dark:text-teal-400">รอบตัดวีคที่ 1</span>
              <span className="font-mono tabular-nums">{cycleRanges.cycle1.label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ฿{formatBaht(cycleSummary.cycle1.netPay)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>ทำงาน {cycleSummary.cycle1.workdays} วัน</span>
            <span>OT {formatHours(cycleSummary.cycle1.otHours)} ชม. (฿{formatBaht(cycleSummary.cycle1.otPayTotal)})</span>
          </div>
        </div>

        {/* 3. Cycle 2 */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-indigo-600 dark:text-indigo-400">รอบตัดวีคที่ 2</span>
              <span className="font-mono tabular-nums">{cycleRanges.cycle2.label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ฿{formatBaht(cycleSummary.cycle2.netPay)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>ทำงาน {cycleSummary.cycle2.workdays} วัน</span>
            <span>OT {formatHours(cycleSummary.cycle2.otHours)} ชม. (฿{formatBaht(cycleSummary.cycle2.otPayTotal)})</span>
          </div>
        </div>

        {/* 4. Monthly Total */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{summaryBasis === 'pay_cycles' ? 'รวมรายเดือน (2 รอบ)' : 'รวมเดือนปฏิทิน'}</span>
              <span className="font-mono tabular-nums">{activeMonthSummary.workdays} วันทำงาน</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400">
              ฿{formatBaht(activeMonthSummary.netPay)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>แรง ฿{formatBaht(activeMonthSummary.baseWageTotal)}</span>
            <span>OT {formatHours(activeMonthSummary.otHours)} ชม. (฿{formatBaht(activeMonthSummary.otPayTotal)})</span>
          </div>
        </div>
      </div>

      {/* Annual Summary + Monthly Goal Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Goal Progress Card */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                ความคืบหน้าเป้าหมายรายเดือน
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ติดตามยอดรับสุทธิและชั่วโมงโอทีเทียบกับเป้าหมายที่ตั้งไว้
              </p>
            </div>
            <div className="text-right font-mono tabular-nums">
              <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
                {incomeGoalPct}%
              </span>
            </div>
          </div>

          {/* Income Goal Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">เป้าหมายรายได้สุทธิ</span>
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                ฿{formatBaht(activeMonthSummary.netPay)} / ฿{formatBaht(settings.monthlyIncomeGoal)}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-600 dark:bg-teal-500 transition-all duration-300"
                style={{ width: `${incomeGoalPct}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {remainingIncome > 0 ? (
                <span>
                  เหลืออีก <strong className="font-mono tabular-nums text-slate-800 dark:text-slate-200">฿{formatBaht(remainingIncome)}</strong>{' '}
                  (เทียบเท่าทำ OT 1.5x ประมาณ{' '}
                  <strong className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    {formatHours(suggestedOt15Hours)} ชม.
                  </strong>)
                </span>
              ) : (
                <span className="text-teal-600 dark:text-teal-400 font-medium">
                  บรรลุเป้าหมายรายได้ประจำเดือนนี้แล้ว
                </span>
              )}
            </div>
          </div>

          {/* OT Hours Goal Progress */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">เป้าหมายชั่วโมง OT</span>
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {formatHours(activeMonthSummary.otHours)} / {formatHours(settings.monthlyOtHoursGoal)} ชม. ({otHoursGoalPct}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-300"
                style={{ width: `${otHoursGoalPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Annual YTD Overview Card */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                สรุปรายปี {year + 543} ({year})
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {yearSummary.totalWorkdays} วันทำงาน
              </span>
            </div>
            <div className="mt-3 text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              ฿{formatBaht(yearSummary.totalNetPay)}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ยอดรายได้สุทธิสะสมทั้งปี (เฉลี่ยเดือนที่มีข้อมูล ฿{formatBaht(yearSummary.avgMonthlyNet)})
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">ค่าแรงทั้งปี</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                ฿{formatBaht(yearSummary.totalBaseWage)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">ค่าโอทีทั้งปี</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                ฿{formatBaht(yearSummary.totalOtPay)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">ชั่วโมง OT</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatHours(yearSummary.totalOtHours)} ชม.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 12-Month Comparison Bar Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <AnnualBarChart
          year={year}
          months={yearSummary.months}
          monthlyGoal={settings.monthlyIncomeGoal}
          activeMonth={month}
          onSelectMonth={(m) => onChangeMonth(year, m)}
        />
      </div>

      {/* Multiplier Breakdown + Allowances/Deductions + Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Multiplier Breakdown & Allowances/Deductions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Multiplier Breakdown */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              แยกตามตัวคูณเรท OT (เดือนนี้)
            </h3>
            {Object.keys(activeMonthSummary.byMultiplier).length === 0 ? (
              <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                ยังไม่มีบันทึกชั่วโมง OT ในช่วงเวลานี้
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(activeMonthSummary.byMultiplier)
                  .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                  .map(([mult, stat]) => (
                    <div key={mult} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        เรท {mult}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {formatHours(stat.hours)} ชม.
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        ฿{formatBaht(stat.pay)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Allowances & Deductions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                เบี้ยขยัน / รายการเพิ่ม–หัก ประจำรอบ
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                บันทึกรายการพิเศษ เช่น ค่ากะ เบี้ยขยัน หรือหักประกันสังคม/เบิกล่วงหน้า
              </p>
            </div>

            <form onSubmit={handleCreateAdjustment} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={adjCycle}
                  onChange={(e) => setAdjCycle(Number(e.target.value) as 1 | 2)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200"
                >
                  <option value={1}>รอบตัดวีคที่ 1</option>
                  <option value={2}>รอบตัดวีคที่ 2</option>
                </select>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as 'allowance' | 'deduction')}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200"
                >
                  <option value="allowance">+ รายรับเพิ่ม</option>
                  <option value="deduction">- รายการหัก</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={adjLabel}
                  onChange={(e) => setAdjLabel(e.target.value)}
                  placeholder="ชื่อรายการ (เช่น เบี้ยขยัน)"
                  className="flex-1 min-w-0 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="บาท"
                  className="w-24 font-mono tabular-nums text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-teal-600 text-white hover:bg-slate-800 dark:hover:bg-teal-700 transition-colors shrink-0"
                  aria-label="เพิ่มรายการ"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </form>

            {settings.enableSsoDeduction && activeMonthSummary.ssoDeduction > 0 && (
              <div className="flex items-center justify-between text-xs py-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <span>ประกันสังคมอัตโนมัติ (5%)</span>
                <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
                  -฿{formatBaht(activeMonthSummary.ssoDeduction)}
                </span>
              </div>
            )}

            {monthAdjustments.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                {monthAdjustments.map((adj) => (
                  <div key={adj.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {adj.label}
                      </span>
                      <span className="ml-2 text-slate-400 font-mono">รอบ {adj.cycle}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono tabular-nums font-medium ${
                          adj.type === 'allowance'
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {adj.type === 'allowance' ? '+' : '-'}฿{formatBaht(adj.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteAdjustment(adj.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                        aria-label="ลบรายการ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Recorded Days Table */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                รายการบันทึกล่าสุดในช่วงเวลานี้
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {formatThaiShortDate(activeMonthSummary.startDate)} – {formatThaiShortDate(activeMonthSummary.endDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateCalendar(todayKey)}
              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              เปิดปฏิทินทั้งหมด
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ยังไม่มีบันทึกค่าแรงหรือ OT ในช่วงเวลานี้
              </p>
              <button
                type="button"
                onClick={() => onQuickLogDate(todayKey)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>เริ่มบันทึกรายการแรก</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-3">วันที่</th>
                    <th className="py-2.5 px-3">รายละเอียด / หมายเหตุ</th>
                    <th className="py-2.5 px-3 text-right">ชม. OT</th>
                    <th className="py-2.5 pl-3 text-right">ยอดรวม</th>
                    <th className="py-2.5 pl-2 text-right">แก้ไข</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {recentEntries.map((day) => {
                    const t = calculateDayTotals(day);
                    const notes = day.entries
                      .map((e) => `${formatHours(e.hours)}ชม.(${e.multiplier}x)${e.note ? ` ${e.note}` : ''}`)
                      .join(' · ');
                    return (
                      <tr
                        key={day.date}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {formatThaiShortDate(day.date)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[220px] truncate">
                          {notes || day.dayNote || (day.includeDailyWage ? 'วันทำงานปกติ' : 'วันหยุด')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {t.otHours > 0 ? `${formatHours(t.otHours)}` : '—'}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          ฿{formatBaht(t.totalPay)}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => onQuickLogDate(day.date)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:text-teal-400 dark:hover:bg-slate-800 transition-colors"
                            aria-label={`แก้ไข ${day.date}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
