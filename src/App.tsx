import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Cloud,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { DashboardView } from './components/DashboardView';
import { DayEditorPanel } from './components/DayEditorPanel';
import { InteractiveCalendar } from './components/InteractiveCalendar';
import { RateApplyScope, SettingsView } from './components/SettingsView';
import { SyncBackupView } from './components/SyncBackupView';
import { ActiveTab, AdjustmentItem, AppDataState, AppSettings, DayRecord } from './types/ot';
import {
  daysInMonth,
  getCycleRangesForMonth,
  getTodayKey,
  isDateInRange,
  toDateKey,
} from './utils/dateCycle';
import {
  getInitialAppState,
  loadAppState,
  loadTheme,
  saveAppState,
  saveTheme,
} from './utils/storage';

const NAV_ITEMS: { id: ActiveTab; label: string; shortLabel: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'ภาพรวม', shortLabel: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'calendar', label: 'ปฏิทิน OT', shortLabel: 'ปฏิทิน', icon: CalendarDays },
  { id: 'analytics', label: 'วิเคราะห์ & สลิป', shortLabel: 'วิเคราะห์', icon: BarChart3 },
  { id: 'sync', label: 'ส่งออก & คลาวด์', shortLabel: 'ซิงค์', icon: Cloud },
  { id: 'settings', label: 'ตั้งค่าเรท/รอบ', shortLabel: 'ตั้งค่า', icon: Settings },
];

export default function App() {
  const now = new Date();
  const [appState, setAppState] = useState<AppDataState>(() => loadAppState());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [activeYear, setActiveYear] = useState<number>(now.getFullYear());
  const [activeMonth, setActiveMonth] = useState<number>(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());
  const [quickModalDate, setQuickModalDate] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string>('');

  // Persist app state automatically to localStorage
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText((prev) => (prev === msg ? '' : prev));
    }, 3000);
  };

  const handleSaveDay = (record: DayRecord) => {
    setAppState((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [record.date]: record,
      },
    }));
  };

  const handleDeleteDay = (dateKey: string) => {
    setAppState((prev) => {
      const nextDays = { ...prev.days };
      delete nextDays[dateKey];
      return { ...prev, days: nextDays };
    });
    showToast(`ล้างข้อมูลวันที่ ${dateKey} แล้ว`);
  };

  const handleBatchFillWorkdays = (mode: 'mon_fri' | 'mon_sat') => {
    const maxDays = daysInMonth(activeYear, activeMonth);
    let addedCount = 0;

    setAppState((prev) => {
      const nextDays = { ...prev.days };
      for (let d = 1; d <= maxDays; d++) {
        const key = toDateKey(activeYear, activeMonth, d);
        if (nextDays[key]) continue;
        const dow = new Date(activeYear, activeMonth - 1, d).getDay(); // 0=Sun..6=Sat
        const isWorkday =
          mode === 'mon_fri' ? dow >= 1 && dow <= 5 : dow >= 1 && dow <= 6;
        if (isWorkday) {
          nextDays[key] = {
            date: key,
            workdayType: 'workday',
            dailyWage: prev.settings.defaultDailyWage,
            includeDailyWage: true,
            entries: [],
          };
          addedCount += 1;
        }
      }
      return { ...prev, days: nextDays };
    });

    showToast(
      addedCount > 0
        ? `เติมวันทำงานปกติ ${addedCount} วันในเดือนนี้แล้ว`
        : 'ทุกวันทำงานในเดือนนี้มีข้อมูลอยู่แล้ว'
    );
  };

  const handleUpdateSettings = (nextSettings: AppSettings, rateScope: RateApplyScope) => {
    setAppState((prev) => {
      let nextDays = prev.days;

      if (rateScope === 'all_retroactive') {
        nextDays = Object.fromEntries(
          Object.entries(prev.days).map(([dateKey, day]) => [
            dateKey,
            {
              ...day,
              dailyWage: nextSettings.defaultDailyWage,
              entries: day.entries.map((entry) => ({
                ...entry,
                ratePerHour: nextSettings.defaultOtRate,
              })),
            },
          ])
        );
      } else if (rateScope === 'current_cycle') {
        const ranges = getCycleRangesForMonth(activeYear, activeMonth, nextSettings.cycles);
        nextDays = Object.fromEntries(
          Object.entries(prev.days).map(([dateKey, day]) => {
            const inCycle =
              isDateInRange(dateKey, ranges.cycle1.startDate, ranges.cycle1.endDate) ||
              isDateInRange(dateKey, ranges.cycle2.startDate, ranges.cycle2.endDate);
            if (!inCycle) return [dateKey, day];
            return [
              dateKey,
              {
                ...day,
                dailyWage: nextSettings.defaultDailyWage,
                entries: day.entries.map((entry) => ({
                  ...entry,
                  ratePerHour: nextSettings.defaultOtRate,
                })),
              },
            ];
          })
        );
      }

      return {
        ...prev,
        settings: nextSettings,
        days: nextDays,
      };
    });
  };

  const handleAddAdjustment = (item: AdjustmentItem) => {
    setAppState((prev) => ({
      ...prev,
      adjustments: [...prev.adjustments, item],
    }));
    showToast(`เพิ่มรายการ "${item.label}" แล้ว`);
  };

  const handleDeleteAdjustment = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      adjustments: prev.adjustments.filter((a) => a.id !== id),
    }));
  };

  const handleRestoreState = (nextState: AppDataState) => {
    setAppState(nextState);
    showToast('กู้คืนข้อมูลเรียบร้อยแล้ว');
  };

  const handleUpdateSheetMeta = (meta: {
    googleSheetId: string;
    googleSheetUrl: string;
    googleSheetName: string;
    lastGoogleSyncAt: string;
  }) => {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...meta,
      },
    }));
  };

  const handleResetAllData = () => {
    setAppState(getInitialAppState());
    showToast('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            OT &amp; Wage Ledger
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 hover:text-slate-900 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Summary */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex justify-between">
            <span>ค่าแรงพื้นฐาน</span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
              ฿{appState.settings.defaultDailyWage}/วัน
            </span>
          </div>
          <div className="flex justify-between">
            <span>เรท OT เริ่มต้น</span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
              ฿{appState.settings.defaultOtRate}/ชม.
            </span>
          </div>
        </div>
      </aside>

      {/* Main Viewport Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Clean 3-Zone Contract, Compact Mobile Height) */}
        <header className="no-print sticky top-0 z-20 h-14 sm:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              OT Ledger
            </span>
            <span className="hidden lg:inline text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {activeNav.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
              title={theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => setQuickModalDate(selectedDate || getTodayKey())}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>บันทึก OT</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardView
              year={activeYear}
              month={activeMonth}
              daysMap={appState.days}
              adjustments={appState.adjustments}
              settings={appState.settings}
              onChangeMonth={(y, m) => {
                setActiveYear(y);
                setActiveMonth(m);
              }}
              onQuickLogDate={(dKey) => setQuickModalDate(dKey)}
              onAddAdjustment={handleAddAdjustment}
              onDeleteAdjustment={handleDeleteAdjustment}
              onNavigateCalendar={(dKey) => {
                setSelectedDate(dKey);
                setActiveTab('calendar');
              }}
            />
          )}

          {activeTab === 'calendar' && (
            <InteractiveCalendar
              year={activeYear}
              month={activeMonth}
              daysMap={appState.days}
              settings={appState.settings}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onChangeMonth={(y, m) => {
                setActiveYear(y);
                setActiveMonth(m);
              }}
              onSaveDay={handleSaveDay}
              onDeleteDay={handleDeleteDay}
              onBatchFillWorkdays={handleBatchFillWorkdays}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              year={activeYear}
              month={activeMonth}
              daysMap={appState.days}
              adjustments={appState.adjustments}
              settings={appState.settings}
              onChangeMonth={(y, m) => {
                setActiveYear(y);
                setActiveMonth(m);
              }}
            />
          )}

          {activeTab === 'sync' && (
            <SyncBackupView
              year={activeYear}
              month={activeMonth}
              state={appState}
              onRestoreState={handleRestoreState}
              onUpdateSheetMeta={handleUpdateSheetMeta}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              year={activeYear}
              month={activeMonth}
              settings={appState.settings}
              totalRecordedDays={Object.keys(appState.days).length}
              onUpdateSettings={handleUpdateSettings}
              onResetAllData={handleResetAllData}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Compact h-14 <= 15% mobile viewport) */}
      <nav
        className="no-print lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs grid grid-cols-5"
        aria-label="เมนูหลักบนมือถือ"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate max-w-full px-1">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Log OT Modal */}
      {quickModalDate && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-[2px] sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <DayEditorPanel
              dateKey={quickModalDate}
              dayRecord={appState.days[quickModalDate]}
              settings={appState.settings}
              onSaveDay={handleSaveDay}
              onDeleteDay={handleDeleteDay}
              onChangeDate={(newKey) => setQuickModalDate(newKey)}
              onClose={() => setQuickModalDate(null)}
              isModal
            />
          </div>
        </div>
      )}

      {/* Subtle Toast Notification */}
      {toastText && (
        <div className="no-print fixed bottom-18 lg:bottom-6 right-4 z-40 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2.5 text-xs shadow-lg">
          <span>{toastText}</span>
          <button
            type="button"
            onClick={() => setToastText('')}
            className="text-slate-400 hover:text-white"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
