import React, { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AppSettings, DayRecord, OtEntry, WorkdayType } from '../types/ot';
import { calculateDayTotals, calculateEntryPay, formatBaht, formatHours } from '../utils/calculations';
import { formatThaiFullDate } from '../utils/dateCycle';
import { generateId } from '../utils/storage';

interface DayEditorPanelProps {
  dateKey: string;
  dayRecord?: DayRecord;
  settings: AppSettings;
  onSaveDay: (record: DayRecord) => void;
  onDeleteDay: (dateKey: string) => void;
  onChangeDate?: (newDateKey: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

const QUICK_HOURS = [0.5, 1, 1.5, 2, 2.5, 3, 4];
const QUICK_MULTIPLIERS = [1, 1.5, 2, 3];

export const DayEditorPanel: React.FC<DayEditorPanelProps> = ({
  dateKey,
  dayRecord,
  settings,
  onSaveDay,
  onDeleteDay,
  onChangeDate,
  onClose,
  isModal = false,
}) => {
  const currentRecord: DayRecord = dayRecord || {
    date: dateKey,
    workdayType: 'workday',
    dailyWage: settings.defaultDailyWage,
    includeDailyWage: true,
    entries: [],
    dayNote: '',
  };

  const [hoursInput, setHoursInput] = useState<string>('2');
  const [multiplier, setMultiplier] = useState<number>(1.5);
  const [customMult, setCustomMult] = useState<string>('');
  const [rateInput, setRateInput] = useState<string>(String(settings.defaultOtRate));
  const [noteInput, setNoteInput] = useState<string>('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [dailyWageInput, setDailyWageInput] = useState<string>(String(currentRecord.dailyWage));
  const [dayNoteInput, setDayNoteInput] = useState<string>(currentRecord.dayNote || '');
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    const rec = dayRecord || {
      date: dateKey,
      workdayType: 'workday' as WorkdayType,
      dailyWage: settings.defaultDailyWage,
      includeDailyWage: true,
      entries: [],
      dayNote: '',
    };
    setDailyWageInput(String(rec.dailyWage));
    setDayNoteInput(rec.dayNote || '');
    setRateInput(String(settings.defaultOtRate));
    setEditingEntryId(null);
    setHoursInput('2');
    setMultiplier(rec.workdayType === 'holiday_ot' ? 2 : 1.5);
    setCustomMult('');
    setNoteInput('');
    setFormError('');
  }, [dateKey, dayRecord?.date, settings.defaultDailyWage, settings.defaultOtRate]);

  const effectiveMultiplier = customMult !== '' ? parseFloat(customMult) || 0 : multiplier;
  const parsedHours = parseFloat(hoursInput) || 0;
  const parsedRate = parseFloat(rateInput) || 0;
  const previewOtPay =
    parsedHours > 0 && effectiveMultiplier > 0 && parsedRate > 0
      ? parsedHours * effectiveMultiplier * parsedRate
      : 0;

  const totals = calculateDayTotals(dayRecord);

  const handleWorkdayTypeChange = (type: WorkdayType) => {
    const includeWage = type === 'workday';
    const nextWage = parseFloat(dailyWageInput) || settings.defaultDailyWage;
    onSaveDay({
      ...currentRecord,
      date: dateKey,
      workdayType: type,
      dailyWage: nextWage,
      includeDailyWage: includeWage,
      dayNote: dayNoteInput,
    });
    if (!editingEntryId) {
      setMultiplier(type === 'holiday_ot' ? 2 : 1.5);
      setCustomMult('');
    }
  };

  const handleToggleIncludeWage = () => {
    const nextWage = parseFloat(dailyWageInput) || settings.defaultDailyWage;
    onSaveDay({
      ...currentRecord,
      date: dateKey,
      dailyWage: nextWage,
      includeDailyWage: !currentRecord.includeDailyWage,
      dayNote: dayNoteInput,
    });
  };

  const handleDailyWageBlur = () => {
    const val = parseFloat(dailyWageInput);
    if (!isNaN(val) && val >= 0 && (dayRecord || val !== settings.defaultDailyWage)) {
      onSaveDay({
        ...currentRecord,
        date: dateKey,
        dailyWage: val,
        dayNote: dayNoteInput,
      });
    }
  };

  const handleDayNoteBlur = () => {
    if (dayRecord && (dayRecord.dayNote || '') !== dayNoteInput) {
      onSaveDay({
        ...currentRecord,
        date: dateKey,
        dayNote: dayNoteInput,
      });
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setFormError('กรุณาระบุจำนวนชั่วโมง OT มากกว่า 0 (เช่น 0.5, 1.5, 2.5)');
      return;
    }
    if (isNaN(effectiveMultiplier) || effectiveMultiplier <= 0) {
      setFormError('กรุณาระบุตัวคูณเรทมากกว่า 0');
      return;
    }
    if (isNaN(parsedRate) || parsedRate < 0) {
      setFormError('กรุณาระบุเรทค่าโอทีต่อชั่วโมงที่ถูกต้อง');
      return;
    }

    const nextWage = parseFloat(dailyWageInput);
    const baseRecord: DayRecord = {
      ...currentRecord,
      date: dateKey,
      dailyWage: !isNaN(nextWage) && nextWage >= 0 ? nextWage : settings.defaultDailyWage,
      dayNote: dayNoteInput,
    };

    let updatedEntries: OtEntry[];
    if (editingEntryId) {
      updatedEntries = baseRecord.entries.map((item) =>
        item.id === editingEntryId
          ? {
              ...item,
              hours: parsedHours,
              multiplier: effectiveMultiplier,
              ratePerHour: parsedRate,
              note: noteInput.trim(),
            }
          : item
      );
    } else {
      const newEntry: OtEntry = {
        id: generateId(),
        hours: parsedHours,
        multiplier: effectiveMultiplier,
        ratePerHour: parsedRate,
        note: noteInput.trim(),
        createdAt: new Date().toISOString(),
      };
      updatedEntries = [...baseRecord.entries, newEntry];
    }

    onSaveDay({
      ...baseRecord,
      entries: updatedEntries,
    });

    setEditingEntryId(null);
    setHoursInput('2');
    setNoteInput('');
  };

  const handleStartEdit = (entry: OtEntry) => {
    setEditingEntryId(entry.id);
    setHoursInput(String(entry.hours));
    if (QUICK_MULTIPLIERS.includes(entry.multiplier)) {
      setMultiplier(entry.multiplier);
      setCustomMult('');
    } else {
      setCustomMult(String(entry.multiplier));
    }
    setRateInput(String(entry.ratePerHour));
    setNoteInput(entry.note || '');
    setFormError('');
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!dayRecord) return;
    const remaining = dayRecord.entries.filter((e) => e.id !== entryId);
    onSaveDay({
      ...dayRecord,
      entries: remaining,
    });
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
      setNoteInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400">
            <span>รายละเอียดรายวัน</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{dateKey}</span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {formatThaiFullDate(dateKey)}
          </h3>
          {onChangeDate && (
            <div className="mt-2">
              <input
                type="date"
                value={dateKey}
                onChange={(e) => e.target.value && onChangeDate(e.target.value)}
                className="text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Day Summary Strip */}
      <div className="grid grid-cols-3 gap-3 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">ค่าแรงวันนั้น</div>
          <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            ฿{formatBaht(totals.baseWage)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">โอทีรวม</div>
          <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatHours(totals.otHours)} ชม.
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400">ยอดสุทธิวันนี้</div>
          <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-teal-600 dark:text-teal-400">
            ฿{formatBaht(totals.totalPay)}
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto space-y-5 pt-4 ${isModal ? 'max-h-[70vh]' : ''}`}>
        {/* Workday Type & Daily Wage */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            ประเภทวันทำงาน
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
            {[
              { id: 'workday' as WorkdayType, label: 'วันทำงาน' },
              { id: 'holiday_ot' as WorkdayType, label: 'วันหยุดทำ OT' },
              { id: 'day_off' as WorkdayType, label: 'วันหยุด / ลา' },
            ].map((opt) => {
              const active = currentRecord.workdayType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleWorkdayTypeChange(opt.id)}
                  className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {currentRecord.workdayType !== 'day_off' && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={currentRecord.includeDailyWage}
                  onChange={handleToggleIncludeWage}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>นับรวมค่าแรงรายวัน</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dailyWageInput}
                  onChange={(e) => setDailyWageInput(e.target.value)}
                  onBlur={handleDailyWageBlur}
                  disabled={!currentRecord.includeDailyWage}
                  className="w-24 text-right font-mono tabular-nums text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">บาท</span>
              </div>
            </div>
          )}

          <div>
            <input
              type="text"
              value={dayNoteInput}
              onChange={(e) => setDayNoteInput(e.target.value)}
              onBlur={handleDayNoteBlur}
              placeholder="บันทึกประจำวัน (เช่น กะเช้า, วันหยุดนักขัตฤกษ์)..."
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Add / Edit OT Form */}
        <form
          onSubmit={handleSaveEntry}
          className="space-y-3.5 pt-4 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editingEntryId ? 'แก้ไขรายการโอที' : 'เพิ่มบันทึกโอที'}
            </h4>
            {editingEntryId && (
              <button
                type="button"
                onClick={() => {
                  setEditingEntryId(null);
                  setNoteInput('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                ยกเลิกแก้ไข
              </button>
            )}
          </div>

          {/* Decimal Hours + Quick Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                จำนวนชั่วโมง OT (รองรับทศนิยม)
              </label>
              <span className="text-xs font-mono text-slate-400">เช่น 0.5, 1.5, 2.5</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                className="w-full font-mono tabular-nums text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="2.5"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">ชม.</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_HOURS.map((hr) => {
                const isSelected = parseFloat(hoursInput) === hr;
                return (
                  <button
                    key={hr}
                    type="button"
                    onClick={() => setHoursInput(String(hr))}
                    className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md border transition-colors ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:border-teal-500 dark:text-teal-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {hr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multiplier Quick-Select */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              ตัวคูณเรท (Multiplier)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {QUICK_MULTIPLIERS.map((m) => {
                const active = customMult === '' && multiplier === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMultiplier(m);
                      setCustomMult('');
                    }}
                    className={`py-2 text-xs font-mono font-semibold rounded-lg border transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white dark:bg-teal-600 dark:border-teal-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {m}x
                  </button>
                );
              })}
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={customMult}
                onChange={(e) => setCustomMult(e.target.value)}
                placeholder="อื่นๆ"
                className="px-2 py-2 text-center text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Rate & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                เรทฐาน (บาท/ชม.)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-full font-mono tabular-nums text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                หมายเหตุ
              </label>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="เช่น เร่งส่งสินค้า..."
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              คำนวณได้:{' '}
              <span className="font-mono tabular-nums font-semibold text-teal-600 dark:text-teal-400">
                ฿{formatBaht(previewOtPay)}
              </span>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              {editingEntryId ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{editingEntryId ? 'อัปเดตรายการ' : 'เพิ่มโอที'}</span>
            </button>
          </div>
        </form>

        {/* Recorded Entries List */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              รายการโอทีของวันนี้ ({dayRecord?.entries.length || 0})
            </h4>
            {dayRecord && (
              <button
                type="button"
                onClick={() => onDeleteDay(dateKey)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
              >
                ล้างข้อมูลวันนี้
              </button>
            )}
          </div>

          {!dayRecord || dayRecord.entries.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              ยังไม่มีรายการ OT สำหรับวันนี้ — กดเพิ่มด้านบนได้เลย
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
              {dayRecord.entries.map((entry) => {
                const pay = calculateEntryPay(entry);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        <span>{formatHours(entry.hours)} ชม.</span>
                        <span className="text-slate-400" aria-hidden="true">×</span>
                        <span className="text-amber-600 dark:text-amber-400">{entry.multiplier}x</span>
                        <span className="text-slate-400" aria-hidden="true">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          @{entry.ratePerHour}฿
                        </span>
                      </div>
                      {entry.note && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          {entry.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold font-mono tabular-nums text-teal-600 dark:text-teal-400">
                        ฿{formatBaht(pay)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(entry)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                        aria-label="แก้ไขรายการ"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/50 transition-colors"
                        aria-label="ลบรายการ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
