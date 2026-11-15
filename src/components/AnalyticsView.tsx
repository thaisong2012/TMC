import React, { useMemo, useState } from 'react';
import { Calculator, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { AdjustmentItem, AppSettings, DayRecord } from '../types/ot';
import {
  formatBaht,
  formatHours,
  summarizeCyclePayMonth,
  summarizeYear,
} from '../utils/calculations';
import {
  formatThaiMonthYear,
  getCycleRangesForMonth,
  THAI_MONTHS,
} from '../utils/dateCycle';
import { AnnualBarChart } from './AnnualBarChart';

interface AnalyticsViewProps {
  year: number;
  month: number;
  daysMap: Record<string, DayRecord>;
  adjustments: AdjustmentItem[];
  settings: AppSettings;
  onChangeMonth: (year: number, month: number) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  year,
  month,
  daysMap,
  adjustments,
  settings,
  onChangeMonth,
}) => {
  const [basis, setBasis] = useState<'pay_cycles' | 'calendar'>('pay_cycles');
  const [slipScope, setSlipScope] = useState<'cycle1' | 'cycle2' | 'combined'>('combined');
  const [simTargetExtra, setSimTargetExtra] = useState<string>('3000');
  const [simMultiplier, setSimMultiplier] = useState<number>(1.5);

  const yearSummary = useMemo(
    () => summarizeYear(daysMap, year, adjustments, settings, basis),
    [daysMap, year, adjustments, settings, basis]
  );

  const cycleSummary = useMemo(
    () => summarizeCyclePayMonth(daysMap, year, month, adjustments, settings),
    [daysMap, year, month, adjustments, settings]
  );

  const cycleRanges = useMemo(
    () => getCycleRangesForMonth(year, month, settings.cycles),
    [year, month, settings.cycles]
  );

  const activeSlip =
    slipScope === 'cycle1'
      ? cycleSummary.cycle1
      : slipScope === 'cycle2'
        ? cycleSummary.cycle2
        : cycleSummary.combined;

  const slipRangeLabel =
    slipScope === 'cycle1'
      ? `รอบตัดวีคที่ 1 (${cycleRanges.cycle1.label})`
      : slipScope === 'cycle2'
        ? `รอบตัดวีคที่ 2 (${cycleRanges.cycle2.label})`
        : `รวม 2 รอบ (${cycleRanges.cycle1.label} และ ${cycleRanges.cycle2.label})`;

  const extraAmount = parseFloat(simTargetExtra) || 0;
  const hourlyEffective = settings.defaultOtRate * simMultiplier;
  const requiredSimHours = hourlyEffective > 0 ? extraAmount / hourlyEffective : 0;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(year - 1, month)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="ปีก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-base font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            ปี {year + 543} ({year})
          </span>
          <button
            type="button"
            onClick={() => onChangeMonth(year + 1, month)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label="ปีถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setBasis('pay_cycles')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              basis === 'pay_cycles'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            สรุปตามรอบตัดวีค
          </button>
          <button
            type="button"
            onClick={() => setBasis('calendar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              basis === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            สรุปตามเดือนปฏิทิน
          </button>
        </div>
      </div>

      {/* 12-Month Chart */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <AnnualBarChart
          year={year}
          months={yearSummary.months}
          monthlyGoal={settings.monthlyIncomeGoal}
          activeMonth={month}
          onSelectMonth={(m) => onChangeMonth(year, m)}
        />
      </div>

      {/* 12-Month Numeric Ledger Table */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
          ตารางสรุปรายได้ 12 เดือน ปี {year + 543}
        </h3>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-3">เดือน</th>
                <th className="py-2.5 px-3 text-right">วันทำงาน</th>
                <th className="py-2.5 px-3 text-right">ชม. OT</th>
                <th className="py-2.5 px-3 text-right">ค่าแรงพื้นฐาน</th>
                <th className="py-2.5 px-3 text-right">ค่าโอที</th>
                <th className="py-2.5 px-3 text-right">เพิ่ม / หัก</th>
                <th className="py-2.5 pl-3 text-right">ยอดสุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {yearSummary.months.map((m) => {
                const netAdj = m.allowance - m.deduction;
                return (
                  <tr
                    key={m.month}
                    onClick={() => onChangeMonth(year, m.month)}
                    className={`cursor-pointer transition-colors ${
                      m.month === month
                        ? 'bg-teal-50/60 dark:bg-teal-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {THAI_MONTHS[m.month - 1]}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {m.workdays}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {formatHours(m.otHours)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      ฿{formatBaht(m.baseWage)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      ฿{formatBaht(m.otPay)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {netAdj === 0 ? '—' : `${netAdj > 0 ? '+' : ''}฿${formatBaht(netAdj)}`}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-teal-600 dark:text-teal-400">
                      ฿{formatBaht(m.netPay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <td className="py-3 pr-3">รวมทั้งปี {year + 543}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{yearSummary.totalWorkdays}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {formatHours(yearSummary.totalOtHours)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  ฿{formatBaht(yearSummary.totalBaseWage)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  ฿{formatBaht(yearSummary.totalOtPay)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  ฿{formatBaht(yearSummary.totalAllowance - yearSummary.totalDeduction)}
                </td>
                <td className="py-3 pl-3 text-right font-mono tabular-nums text-teal-600 dark:text-teal-400">
                  ฿{formatBaht(yearSummary.totalNetPay)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom Row: OT Simulator & Printable Pay Slip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* What-If OT Simulator */}
        <div className="no-print lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              เครื่องคำนวณวางแผน OT (What-If)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            คำนวณจำนวนชั่วโมง OT ที่ต้องทำเพิ่มเพื่อให้ได้ยอดเงินตามเป้าหมาย (อิงเรท ฿{settings.defaultOtRate}/ชม.)
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                อยากได้เงิน OT เพิ่มอีก (บาท)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={simTargetExtra}
                onChange={(e) => setSimTargetExtra(e.target.value)}
                className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                ตัวคูณเรทที่ใช้คำนวณ
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 1.5, 2, 3].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSimMultiplier(m)}
                    className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-colors ${
                      simMultiplier === m
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ชั่วโมง OT ที่ต้องทำ ({simMultiplier}x = ฿{formatBaht(hourlyEffective)}/ชม.)
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400">
              {formatHours(requiredSimHours)} ชม.
            </span>
          </div>
        </div>

        {/* Printable Payslip Summary */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ใบสรุปรายได้จำลอง — {formatThaiMonthYear(year, month)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {slipRangeLabel}
              </p>
            </div>
            <div className="no-print flex items-center gap-2">
              <select
                value={slipScope}
                onChange={(e) => setSlipScope(e.target.value as 'cycle1' | 'cycle2' | 'combined')}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-700 dark:text-slate-200"
              >
                <option value="combined">รวม 2 รอบ</option>
                <option value="cycle1">เฉพาะรอบ 1</option>
                <option value="cycle2">เฉพาะรอบ 2</option>
              </select>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>พิมพ์สรุป</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600 dark:text-slate-300">
                ค่าแรงพื้นฐาน ({activeSlip.workdays} วันทำงาน)
              </span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                ฿{formatBaht(activeSlip.baseWageTotal)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600 dark:text-slate-300">
                ค่าล่วงเวลา OT ({formatHours(activeSlip.otHours)} ชม.)
              </span>
              <span className="font-mono tabular-nums font-medium text-amber-600 dark:text-amber-400">
                ฿{formatBaht(activeSlip.otPayTotal)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600 dark:text-slate-300">เบี้ยขยัน / รายรับเพิ่มเติม</span>
              <span className="font-mono tabular-nums font-medium text-teal-600 dark:text-teal-400">
                +฿{formatBaht(activeSlip.allowanceTotal)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">รายการหักอื่นๆ</span>
              <span className="font-mono tabular-nums font-medium text-rose-600 dark:text-rose-400">
                -฿{formatBaht(activeSlip.deductionTotal)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600 dark:text-slate-300">หักประกันสังคม (5%)</span>
              <span className="font-mono tabular-nums font-medium text-rose-600 dark:text-rose-400">
                -฿{formatBaht(activeSlip.ssoDeduction)}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-slate-200 dark:border-slate-700 text-sm font-bold">
              <span className="text-slate-900 dark:text-slate-100">ยอดรับสุทธิโดยประมาณ</span>
              <span className="font-mono tabular-nums text-teal-600 dark:text-teal-400">
                ฿{formatBaht(activeSlip.netPay)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
