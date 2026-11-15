import React, { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppSettings, DayRecord } from '../types/ot';
import { calculateDayTotals, formatBaht, formatHours } from '../utils/calculations';
import {
  daysInMonth,
  getCycleRangesForMonth,
  getTodayKey,
  shiftMonth,
  THAI_MONTHS_SHORT,
  THAI_WEEKDAYS_MON,
  THAI_WEEKDAYS_SUN,
  toDateKey,
  whichCycleInMonth,
} from '../utils/dateCycle';
import { DayEditorPanel } from './DayEditorPanel';

interface InteractiveCalendarProps {
  year: number;
  month: number;
  daysMap: Record<string, DayRecord>;
  settings: AppSettings;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onChangeMonth: (year: number, month: number) => void;
  onSaveDay: (record: DayRecord) => void;
  onDeleteDay: (dateKey: string) => void;
  onBatchFillWorkdays: (mode: 'mon_fri' | 'mon_sat') => void;
}

interface CalendarCell {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  cycle: 1 | 2 | null;
}

export const InteractiveCalendar: React.FC<InteractiveCalendarProps> = ({
  year,
  month,
  daysMap,
  settings,
  selectedDate,
  onSelectDate,
  onChangeMonth,
  onSaveDay,
  onDeleteDay,
  onBatchFillWorkdays,
}) => {
  const [cycleFilter, setCycleFilter] = useState<'all' | 1 | 2>('all');
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  const todayKey = getTodayKey();
  const cycleRanges = useMemo(
    () => getCycleRangesForMonth(year, month, settings.cycles),
    [year, month, settings.cycles]
  );

  const weekdays = settings.weekStartsOnMonday ? THAI_WEEKDAYS_MON : THAI_WEEKDAYS_SUN;

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const firstDayObj = new Date(year, month - 1, 1);
    const rawDow = firstDayObj.getDay(); // 0=Sun..6=Sat
    const leadingCount = settings.weekStartsOnMonday ? (rawDow === 0 ? 6 : rawDow - 1) : rawDow;
    const totalDaysInCurr = daysInMonth(year, month);
    const prev = shiftMonth(year, month, -1);
    const prevTotal = daysInMonth(prev.year, prev.month);
    const next = shiftMonth(year, month, 1);

    const cells: CalendarCell[] = [];

    for (let i = leadingCount - 1; i >= 0; i--) {
      const d = prevTotal - i;
      const dKey = toDateKey(prev.year, prev.month, d);
      cells.push({
        dateKey: dKey,
        dayNumber: d,
        isCurrentMonth: false,
        cycle: whichCycleInMonth(dKey, year, month, settings.cycles),
      });
    }

    for (let d = 1; d <= totalDaysInCurr; d++) {
      const dKey = toDateKey(year, month, d);
      cells.push({
        dateKey: dKey,
        dayNumber: d,
        isCurrentMonth: true,
        cycle: whichCycleInMonth(dKey, year, month, settings.cycles),
      });
    }

    const totalCells = cells.length <= 35 ? 35 : 42;
    const trailingCount = totalCells - cells.length;
    for (let d = 1; d <= trailingCount; d++) {
      const dKey = toDateKey(next.year, next.month, d);
      cells.push({
        dateKey: dKey,
        dayNumber: d,
        isCurrentMonth: false,
        cycle: whichCycleInMonth(dKey, year, month, settings.cycles),
      });
    }

    return cells;
  }, [year, month, settings.weekStartsOnMonday, settings.cycles]);

  const handleCellClick = (dateKey: string) => {
    onSelectDate(dateKey);
    setMobileEditorOpen(true);
  };

  const handlePrevMonth = () => {
    const prev = shiftMonth(year, month, -1);
    onChangeMonth(prev.year, prev.month);
  };

  const handleNextMonth = () => {
    const next = shiftMonth(year, month, 1);
    onChangeMonth(next.year, next.month);
  };

  const handleJumpToday = () => {
    const now = new Date();
    onChangeMonth(now.getFullYear(), now.getMonth() + 1);
    onSelectDate(todayKey);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Calendar Main Area */}
      <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        {/* Calendar Top Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[140px] text-center sm:text-left px-1">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {THAI_MONTHS_SHORT[month - 1]} {year + 543}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {year}-{String(month).padStart(2, '0')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="เดือนถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleJumpToday}
              className="ml-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              วันนี้
            </button>
          </div>

          {/* Cycle Highlight Segmented Control */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
            {[
              { id: 'all' as const, label: 'ทั้งหมด' },
              { id: 1 as const, label: 'รอบที่ 1' },
              { id: 2 as const, label: 'รอบที่ 2' },
            ].map((tab) => (
              <button
                key={String(tab.id)}
                type="button"
                onClick={() => setCycleFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  cycleFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cycle Ranges Legend & Quick Auto-Fill */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 py-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <strong className="font-medium text-teal-700 dark:text-teal-400">รอบ 1:</strong>{' '}
              <span className="font-mono tabular-nums">{cycleRanges.cycle1.label}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-medium text-indigo-600 dark:text-indigo-400">รอบ 2:</strong>{' '}
              <span className="font-mono tabular-nums">{cycleRanges.cycle2.label}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">เติมค่าแรงอัตโนมัติ:</span>
            <button
              type="button"
              onClick={() => onBatchFillWorkdays('mon_fri')}
              className="text-teal-700 dark:text-teal-400 hover:underline font-medium whitespace-nowrap"
            >
              จ.–ศ.
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => onBatchFillWorkdays('mon_sat')}
              className="text-teal-700 dark:text-teal-400 hover:underline font-medium whitespace-nowrap"
            >
              จ.–ส.
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-t border-l border-slate-200 dark:border-slate-800 rounded-t-lg overflow-hidden">
          {weekdays.map((wd) => (
            <div
              key={wd}
              className="py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border-r border-b border-slate-200 dark:border-slate-800"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-l border-slate-200 dark:border-slate-800 rounded-b-lg overflow-hidden">
          {calendarCells.map((cell) => {
            const record = daysMap[cell.dateKey];
            const totals = calculateDayTotals(record);
            const isSelected = cell.dateKey === selectedDate;
            const isToday = cell.dateKey === todayKey;
            const dimmedByFilter =
              cycleFilter !== 'all' && cell.cycle !== cycleFilter;

            const cellBg = isSelected
              ? 'bg-teal-50/90 dark:bg-teal-950/50 ring-2 ring-inset ring-teal-600 dark:ring-teal-500'
              : !cell.isCurrentMonth
                ? 'bg-slate-50/60 dark:bg-slate-950/50'
                : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60';

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => handleCellClick(cell.dateKey)}
                className={`relative min-h-[76px] sm:min-h-[96px] p-1.5 sm:p-2 text-left border-r border-b border-slate-200 dark:border-slate-800 transition-colors flex flex-col justify-between ${cellBg} ${
                  dimmedByFilter ? 'opacity-35' : ''
                }`}
              >
                {/* Top row: Day number + Cycle marker */}
                <div className="flex items-start justify-between gap-1 w-full">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-mono tabular-nums font-semibold ${
                      isToday
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : cell.isCurrentMonth
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  {cell.cycle && (
                    <span
                      className={`text-[10px] font-mono tabular-nums font-medium ${
                        cell.cycle === 1
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      ร.{cell.cycle}
                    </span>
                  )}
                </div>

                {/* Bottom summary: Wage + OT */}
                <div className="mt-1 space-y-0.5 w-full">
                  {record ? (
                    <>
                      <div className="text-[10px] sm:text-[11px] truncate text-slate-500 dark:text-slate-400">
                        {record.workdayType === 'day_off'
                          ? 'วันหยุด'
                          : record.workdayType === 'holiday_ot'
                            ? 'หยุดทำ OT'
                            : record.includeDailyWage
                              ? 'ทำงาน'
                              : 'ไม่นับแรง'}
                      </div>
                      {totals.otHours > 0 && (
                        <div className="text-[10px] sm:text-xs font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 truncate">
                          +{formatHours(totals.otHours)}ชม.
                        </div>
                      )}
                      {totals.totalPay > 0 && (
                        <div className="text-[10px] sm:text-xs font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400 truncate">
                          ฿{formatBaht(totals.totalPay)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-300 dark:text-slate-700 select-none">
                      —
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Side Inspector */}
      <div className="hidden lg:block lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sticky top-6">
        <DayEditorPanel
          dateKey={selectedDate}
          dayRecord={daysMap[selectedDate]}
          settings={settings}
          onSaveDay={onSaveDay}
          onDeleteDay={onDeleteDay}
        />
      </div>

      {/* Mobile Bottom Sheet / Modal Inspector */}
      {mobileEditorOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex justify-center pb-2 sm:hidden">
              <button
                type="button"
                onClick={() => setMobileEditorOpen(false)}
                className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700"
                aria-label="เลื่อนลงเพื่อปิด"
              />
            </div>
            <DayEditorPanel
              dateKey={selectedDate}
              dayRecord={daysMap[selectedDate]}
              settings={settings}
              onSaveDay={onSaveDay}
              onDeleteDay={onDeleteDay}
              onClose={() => setMobileEditorOpen(false)}
              isModal
            />
          </div>
        </div>
      )}

    </div>
  );
};
