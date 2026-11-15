import React, { useMemo, useState } from 'react';
import { Check, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { AppSettings, CycleConfig, CyclePreset } from '../types/ot';
import { round2 } from '../utils/calculations';
import {
  formatThaiMonthYear,
  getCyclePresetConfig,
  getCycleRangesForMonth,
  shiftMonth,
} from '../utils/dateCycle';
import { ConfirmModal } from './ConfirmModal';

export type RateApplyScope = 'future' | 'current_cycle' | 'all_retroactive';

interface SettingsViewProps {
  year: number;
  month: number;
  settings: AppSettings;
  totalRecordedDays: number;
  onUpdateSettings: (nextSettings: AppSettings, rateScope: RateApplyScope) => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  year,
  month,
  settings,
  totalRecordedDays,
  onUpdateSettings,
  onResetAllData,
}) => {
  const [dailyWage, setDailyWage] = useState<string>(String(settings.defaultDailyWage));
  const [otRate, setOtRate] = useState<string>(String(settings.defaultOtRate));
  const [stdHours, setStdHours] = useState<string>(String(settings.standardHoursPerDay));
  const [rateScope, setRateScope] = useState<RateApplyScope>('future');

  const [cycles, setCycles] = useState<CycleConfig>(settings.cycles);
  const [incomeGoal, setIncomeGoal] = useState<string>(String(settings.monthlyIncomeGoal));
  const [otHoursGoal, setOtHoursGoal] = useState<string>(String(settings.monthlyOtHoursGoal));
  const [enableSso, setEnableSso] = useState<boolean>(settings.enableSsoDeduction);
  const [ssoCap, setSsoCap] = useState<string>(String(settings.ssoMaxCap));
  const [weekMonday, setWeekMonday] = useState<boolean>(settings.weekStartsOnMonday);

  const [savedBanner, setSavedBanner] = useState<string>('');
  const [confirmRetroOpen, setConfirmRetroOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<AppSettings | null>(null);

  const previewMonths = useMemo(() => {
    const m0 = { year, month };
    const m1 = shiftMonth(year, month, 1);
    const febYear = month <= 2 ? year : year + 1;
    const mFeb = { year: febYear, month: 2 };
    const mMar = { year: febYear, month: 3 };
    return [m0, m1, mFeb, mMar].map((item) => ({
      title: formatThaiMonthYear(item.year, item.month),
      ranges: getCycleRangesForMonth(item.year, item.month, cycles),
    }));
  }, [year, month, cycles]);

  const handleSelectPreset = (preset: CyclePreset) => {
    setCycles(getCyclePresetConfig(preset));
  };

  const handleComputeOtFromDaily = () => {
    const wage = parseFloat(dailyWage) || 0;
    const hrs = parseFloat(stdHours) || 8;
    if (wage > 0 && hrs > 0) {
      setOtRate(String(round2(wage / hrs)));
    }
  };

  const buildNextSettings = (): AppSettings => ({
    ...settings,
    defaultDailyWage: Math.max(0, parseFloat(dailyWage) || 0),
    defaultOtRate: Math.max(0, parseFloat(otRate) || 0),
    standardHoursPerDay: Math.max(1, parseFloat(stdHours) || 8),
    monthlyIncomeGoal: Math.max(0, parseFloat(incomeGoal) || 0),
    monthlyOtHoursGoal: Math.max(0, parseFloat(otHoursGoal) || 0),
    enableSsoDeduction: enableSso,
    ssoMaxCap: Math.max(0, parseFloat(ssoCap) || 750),
    weekStartsOnMonday: weekMonday,
    cycles,
  });

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = buildNextSettings();
    const rateChanged =
      next.defaultDailyWage !== settings.defaultDailyWage ||
      next.defaultOtRate !== settings.defaultOtRate;

    if (rateScope !== 'future' && totalRecordedDays > 0 && (rateChanged || rateScope === 'all_retroactive' || rateScope === 'current_cycle')) {
      setPendingSettings(next);
      setConfirmRetroOpen(true);
      return;
    }

    onUpdateSettings(next, 'future');
    setSavedBanner('บันทึกการตั้งค่าทั้งหมดเรียบร้อยแล้ว');
    setTimeout(() => setSavedBanner(''), 3500);
  };

  const handleConfirmRetroApply = () => {
    if (!pendingSettings) return;
    onUpdateSettings(pendingSettings, rateScope);
    setConfirmRetroOpen(false);
    setPendingSettings(null);
    setSavedBanner(
      rateScope === 'all_retroactive'
        ? 'บันทึกการตั้งค่าและคำนวณเรทย้อนหลังทั้งหมดแล้ว'
        : 'บันทึกการตั้งค่าและอัปเดตเรทรอบตัดวีคปัจจุบันแล้ว'
    );
    setTimeout(() => setSavedBanner(''), 4000);
  };

  return (
    <form onSubmit={handleSaveSubmit} className="space-y-6 max-w-4xl">
      {savedBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 px-4 py-3 text-xs font-medium text-teal-800 dark:text-teal-200">
          <Check className="h-4 w-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Section 1: Rate Settings & Retroactive vs Future Choice */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            ตั้งค่าแรงรายวันและเรทโอทีเริ่มต้น
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            ค่าเริ่มต้น 46.5 บาท/ชม. (เทียบเท่าค่าแรงวันละ 372 บาท ÷ 8 ชม.)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              ค่าแรงรายวัน (บาท/วัน)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dailyWage}
              onChange={(e) => setDailyWage(e.target.value)}
              className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              ชั่วโมงทำงานปกติ/วัน
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={stdHours}
              onChange={(e) => setStdHours(e.target.value)}
              className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                เรทโอทีฐาน (บาท/ชม.)
              </label>
              <button
                type="button"
                onClick={handleComputeOtFromDaily}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                <span>คำนวณจากค่าแรง</span>
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={otRate}
              onChange={(e) => setOtRate(e.target.value)}
              className="w-full font-mono tabular-nums text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Apply Rate Scope Choice */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            ขอบเขตการอัปเดตเรทใหม่เมื่อบันทึก
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: 'future' as RateApplyScope,
                title: 'เฉพาะอนาคต',
                desc: 'คงเรทเดิมของรายการที่บันทึกไว้แล้ว',
              },
              {
                id: 'current_cycle' as RateApplyScope,
                title: 'เฉพาะรอบตัดวีคนี้',
                desc: 'อัปเดตรายการในรอบ 1 และ 2 เดือนนี้',
              },
              {
                id: 'all_retroactive' as RateApplyScope,
                title: 'ย้อนหลังทั้งหมด',
                desc: 'คำนวณใหม่ทุกรายการตั้งแต่อดีต',
              },
            ].map((opt) => {
              const active = rateScope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRateScope(opt.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    active
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 dark:border-teal-500'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {opt.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 2: Dual Cycle Cutoff Settings */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            ตั้งค่ารอบตัดวีค 2 รอบต่อเดือน
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            เลือกสูตรมาตรฐานหรือปรับวันเริ่มต้น–สิ้นสุดของรอบที่ 1 และ 2 ได้อย่างอิสระ
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: '29-13_14-28' as CyclePreset, label: 'สูตร 29–13 / 14–28 (ข้ามเดือนอัตโนมัติ)' },
            { id: '1-15_16-eom' as CyclePreset, label: 'สูตร 1–15 / 16–สิ้นเดือน' },
            { id: 'custom' as CyclePreset, label: 'กำหนดเอง (Custom)' },
          ].map((p) => {
            const active = cycles.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Cycle 1 & Cycle 2 Independent Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Cycle 1 */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
            <div className="text-xs font-semibold text-teal-700 dark:text-teal-400">
              รอบตัดวีคที่ 1
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  วันที่เริ่มต้น
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cycles.cycle1.startDay}
                  onChange={(e) =>
                    setCycles({
                      ...cycles,
                      preset: 'custom',
                      cycle1: {
                        ...cycles.cycle1,
                        startDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  วันที่สิ้นสุด (เดือนนี้)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cycles.cycle1.endDay}
                  onChange={(e) =>
                    setCycles({
                      ...cycles,
                      preset: 'custom',
                      cycle1: {
                        ...cycles.cycle1,
                        endDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cycles.cycle1.startFromPrevMonth}
                onChange={(e) =>
                  setCycles({
                    ...cycles,
                    preset: 'custom',
                    cycle1: { ...cycles.cycle1, startFromPrevMonth: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>วันที่เริ่มนับจากเดือนก่อนหน้า (ข้ามเดือนอัตโนมัติ)</span>
            </label>
          </div>

          {/* Cycle 2 */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              รอบตัดวีคที่ 2
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  วันที่เริ่มต้น (เดือนนี้)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cycles.cycle2.startDay}
                  onChange={(e) =>
                    setCycles({
                      ...cycles,
                      preset: 'custom',
                      cycle2: {
                        ...cycles.cycle2,
                        startDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  วันที่สิ้นสุด
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  disabled={cycles.cycle2.endAtMonthEnd}
                  value={cycles.cycle2.endAtMonthEnd ? 31 : cycles.cycle2.endDay}
                  onChange={(e) =>
                    setCycles({
                      ...cycles,
                      preset: 'custom',
                      cycle2: {
                        ...cycles.cycle2,
                        endDay: Math.max(1, Math.min(31, Number(e.target.value) || 28)),
                      },
                    })
                  }
                  className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cycles.cycle2.endAtMonthEnd}
                onChange={(e) =>
                  setCycles({
                    ...cycles,
                    preset: 'custom',
                    cycle2: { ...cycles.cycle2, endAtMonthEnd: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>สิ้นสุดวันสุดท้ายของเดือนอัตโนมัติ (28/29/30/31)</span>
            </label>
          </div>
        </div>

        {/* Live Cycle Preview */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
            ตัวอย่างช่วงวันที่รอบตัดวีคที่จะเกิดขึ้นจริง:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {previewMonths.map((pm) => (
              <div
                key={pm.title}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">{pm.title}</span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  ร1: {pm.ranges.cycle1.label} · ร2: {pm.ranges.cycle2.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Goals, SSO & Calendar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          เป้าหมายรายเดือน ประกันสังคม และปฏิทิน
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              เป้าหมายรายได้สุทธิ/เดือน (บาท)
            </label>
            <input
              type="number"
              step="100"
              min="0"
              value={incomeGoal}
              onChange={(e) => setIncomeGoal(e.target.value)}
              className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              เป้าหมายชั่วโมง OT/เดือน (ชม.)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={otHoursGoal}
              onChange={(e) => setOtHoursGoal(e.target.value)}
              className="w-full font-mono tabular-nums text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={enableSso}
              onChange={(e) => setEnableSso(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>คำนวณหักประกันสังคมอัตโนมัติ (5% ของค่าแรงพื้นฐาน)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">เพดานสูงสุด/เดือน</span>
            <input
              type="number"
              min="0"
              step="50"
              disabled={!enableSso}
              value={ssoCap}
              onChange={(e) => setSsoCap(e.target.value)}
              className="w-24 font-mono tabular-nums text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 disabled:opacity-50"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">บาท</span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={weekMonday}
            onChange={(e) => setWeekMonday(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span>แสดงปฏิทินเริ่มสัปดาห์จากวันจันทร์ (จ.–อา.)</span>
        </label>
      </div>

      {/* Save & Danger Zone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setConfirmResetOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors self-start"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>ล้างข้อมูลทั้งหมดในเครื่อง</span>
        </button>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setDailyWage(String(settings.defaultDailyWage));
              setOtRate(String(settings.defaultOtRate));
              setStdHours(String(settings.standardHoursPerDay));
              setCycles(settings.cycles);
              setIncomeGoal(String(settings.monthlyIncomeGoal));
              setOtHoursGoal(String(settings.monthlyOtHoursGoal));
              setEnableSso(settings.enableSsoDeduction);
              setSsoCap(String(settings.ssoMaxCap));
              setWeekMonday(settings.weekStartsOnMonday);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>คืนค่าที่แก้</span>
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
          >
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmRetroOpen}
        title="ยืนยันการอัปเดตเรทย้อนหลัง?"
        description={
          rateScope === 'all_retroactive'
            ? 'คุณเลือกอัปเดตเรทค่าแรงและค่าโอทีย้อนหลังทั้งหมด ระบบจะคำนวณรายการที่เคยบันทึกไว้ใหม่ด้วยเรทล่าสุด'
            : 'คุณเลือกอัปเดตเรทค่าแรงและค่าโอทีสำหรับรอบตัดวีคปัจจุบัน ระบบจะปรับเรทของรายการในช่วงรอบตัดวีคเดือนนี้'
        }
        details={[
          `ค่าแรงรายวันใหม่: ฿${pendingSettings?.defaultDailyWage ?? dailyWage}/วัน`,
          `เรทฐาน OT ใหม่: ฿${pendingSettings?.defaultOtRate ?? otRate}/ชม.`,
        ]}
        confirmLabel="ยืนยันคำนวณใหม่"
        tone="warning"
        onConfirm={handleConfirmRetroApply}
        onCancel={() => setConfirmRetroOpen(false)}
      />

      <ConfirmModal
        open={confirmResetOpen}
        title="ล้างข้อมูลทั้งหมดในเบราว์เซอร์?"
        description="การดำเนินการนี้จะลบบันทึก OT ค่าแรงรายวัน และรายการเพิ่มเติมทั้งหมดออกจาก LocalStorage ของเบราว์เซอร์อย่างถาวร (ไม่สามารถย้อนกลับได้หากไม่ได้สำรอง .JSON ไว้)"
        confirmLabel="ล้างข้อมูลทั้งหมด"
        tone="danger"
        onConfirm={() => {
          onResetAllData();
          setConfirmResetOpen(false);
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </form>
  );
};
