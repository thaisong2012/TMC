import React, { useState } from 'react';
import { formatBaht, formatHours, MonthlyChartDatum } from '../utils/calculations';

interface AnnualBarChartProps {
  year: number;
  months: MonthlyChartDatum[];
  monthlyGoal?: number;
  activeMonth?: number;
  onSelectMonth?: (month: number) => void;
}

export const AnnualBarChart: React.FC<AnnualBarChartProps> = ({
  year,
  months,
  monthlyGoal = 0,
  activeMonth,
  onSelectMonth,
}) => {
  const [chartMode, setChartMode] = useState<'income' | 'hours'>('income');
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const focusedMonth = hoveredMonth ?? activeMonth ?? new Date().getMonth() + 1;
  const focusedDatum = months.find((m) => m.month === focusedMonth) || months[0];

  const maxValue =
    chartMode === 'income'
      ? Math.max(
          monthlyGoal || 0,
          ...months.map((m) => m.baseWage + m.otPay + m.allowance),
          1000
        )
      : Math.max(...months.map((m) => m.otHours), 10);

  const chartHeight = 220;
  const chartWidth = 720;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 32;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;
  const colW = plotW / 12;
  const barW = Math.min(28, colW * 0.56);

  const goalY =
    chartMode === 'income' && monthlyGoal > 0
      ? padTop + plotH - (monthlyGoal / maxValue) * plotH
      : null;

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            กราฟเปรียบเทียบ 12 เดือน (ปี {year + 543})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            แตะหรือเลื่อนเมาส์บนแท่งกราฟเพื่อดูรายละเอียดแต่ละเดือน
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartMode('income')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              chartMode === 'income'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            รายได้ (ค่าแรง + OT)
          </button>
          <button
            type="button"
            onClick={() => setChartMode('hours')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              chartMode === 'hours'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ชั่วโมง OT
          </button>
        </div>
      </div>

      {/* Focused Month Detail Strip */}
      {focusedDatum && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3 px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">เดือนที่เลือก</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {focusedDatum.label} {year + 543}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ค่าแรงพื้นฐาน</div>
            <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              ฿{formatBaht(focusedDatum.baseWage)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ค่าโอที</div>
            <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
              ฿{formatBaht(focusedDatum.otPay)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ชั่วโมง OT</div>
            <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              {formatHours(focusedDatum.otHours)} ชม.
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 sm:text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">ยอดสุทธิ</div>
            <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-teal-600 dark:text-teal-400">
              ฿{formatBaht(focusedDatum.netPay)}
            </div>
          </div>
        </div>
      )}

      {/* Responsive SVG Bar Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[540px] h-auto select-none"
          role="img"
          aria-label="กราฟแท่งเปรียบเทียบรายได้และชั่วโมงโอที 12 เดือน"
        >
          {/* Horizontal gridlines & Y labels */}
          {yTicks.map((ratio) => {
            const y = padTop + plotH - ratio * plotH;
            const val = maxValue * ratio;
            const label =
              chartMode === 'income'
                ? val >= 1000
                  ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
                  : `${Math.round(val)}`
                : `${Math.round(val)}`;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Monthly Goal Reference Line */}
          {goalY !== null && goalY >= padTop && goalY <= padTop + plotH && (
            <g>
              <line
                x1={padLeft}
                y1={goalY}
                x2={chartWidth - padRight}
                y2={goalY}
                className="stroke-teal-600 dark:stroke-teal-400"
                strokeWidth={1.25}
                strokeDasharray="4 4"
              />
              <text
                x={chartWidth - padRight}
                y={goalY - 4}
                textAnchor="end"
                className="fill-teal-700 dark:fill-teal-400 text-[10px] font-medium"
              >
                เป้าหมาย ฿{formatBaht(monthlyGoal)}
              </text>
            </g>
          )}

          {/* Bars */}
          {months.map((m, idx) => {
            const centerX = padLeft + colW * idx + colW / 2;
            const x = centerX - barW / 2;
            const isActive = m.month === focusedMonth;

            if (chartMode === 'income') {
              const total = m.baseWage + m.otPay + m.allowance;
              const baseH = (m.baseWage / maxValue) * plotH;
              const otH = ((m.otPay + m.allowance) / maxValue) * plotH;
              const baseY = padTop + plotH - baseH;
              const otY = baseY - otH;

              return (
                <g
                  key={m.month}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMonth(m.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  onClick={() => onSelectMonth?.(m.month)}
                >
                  {/* Hover column highlight */}
                  <rect
                    x={padLeft + colW * idx + 2}
                    y={padTop}
                    width={colW - 4}
                    height={plotH}
                    rx={6}
                    className={
                      isActive
                        ? 'fill-slate-100/80 dark:fill-slate-800/50'
                        : 'fill-transparent hover:fill-slate-100/50 dark:hover:fill-slate-800/30'
                    }
                  />
                  {/* Base Wage Segment */}
                  {baseH > 0 && (
                    <rect
                      x={x}
                      y={baseY}
                      width={barW}
                      height={baseH}
                      rx={otH > 0 ? 0 : 4}
                      className="fill-teal-600 dark:fill-teal-500 transition-opacity"
                      opacity={isActive ? 1 : 0.85}
                    />
                  )}
                  {/* OT + Allowance Segment */}
                  {otH > 0 && (
                    <rect
                      x={x}
                      y={otY}
                      width={barW}
                      height={otH}
                      rx={4}
                      className="fill-amber-500 dark:fill-amber-400 transition-opacity"
                      opacity={isActive ? 1 : 0.88}
                    />
                  )}
                  {total === 0 && (
                    <rect
                      x={x}
                      y={padTop + plotH - 2}
                      width={barW}
                      height={2}
                      className="fill-slate-200 dark:fill-slate-800"
                    />
                  )}
                  <text
                    x={centerX}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className={`text-[11px] ${
                      isActive
                        ? 'fill-slate-900 dark:fill-slate-100 font-semibold'
                        : 'fill-slate-500 dark:fill-slate-400'
                    }`}
                  >
                    {m.label}
                  </text>
                </g>
              );
            } else {
              const hrH = (m.otHours / maxValue) * plotH;
              const hrY = padTop + plotH - hrH;
              return (
                <g
                  key={m.month}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMonth(m.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  onClick={() => onSelectMonth?.(m.month)}
                >
                  <rect
                    x={padLeft + colW * idx + 2}
                    y={padTop}
                    width={colW - 4}
                    height={plotH}
                    rx={6}
                    className={
                      isActive
                        ? 'fill-slate-100/80 dark:fill-slate-800/50'
                        : 'fill-transparent hover:fill-slate-100/50 dark:hover:fill-slate-800/30'
                    }
                  />
                  {hrH > 0 ? (
                    <rect
                      x={x}
                      y={hrY}
                      width={barW}
                      height={hrH}
                      rx={4}
                      className="fill-amber-500 dark:fill-amber-400"
                      opacity={isActive ? 1 : 0.88}
                    />
                  ) : (
                    <rect
                      x={x}
                      y={padTop + plotH - 2}
                      width={barW}
                      height={2}
                      className="fill-slate-200 dark:fill-slate-800"
                    />
                  )}
                  <text
                    x={centerX}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    className={`text-[11px] ${
                      isActive
                        ? 'fill-slate-900 dark:fill-slate-100 font-semibold'
                        : 'fill-slate-500 dark:fill-slate-400'
                    }`}
                  >
                    {m.label}
                  </text>
                </g>
              );
            }
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-400">
        {chartMode === 'income' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-teal-600 dark:bg-teal-500" />
              <span>ค่าแรงพื้นฐาน</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-amber-500 dark:bg-amber-400" />
              <span>ค่าโอทีและเบี้ยเพิ่ม</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-amber-500 dark:bg-amber-400" />
            <span>ชั่วโมงโอทีสะสมต่อเดือน</span>
          </div>
        )}
      </div>
    </div>
  );
};
