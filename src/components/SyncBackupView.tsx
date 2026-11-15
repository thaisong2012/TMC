import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CloudUpload,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderSync,
  LogOut,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppDataState } from '../types/ot';
import {
  createAndSyncSpreadsheet,
  deleteDriveFile,
  DriveFileItem,
  getWorkspaceAccessToken,
  initWorkspaceAuth,
  listAppDriveFiles,
  restoreBackupFromDrive,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  syncExistingSpreadsheet,
  uploadJsonBackupToDrive,
} from '../services/googleWorkspace';
import {
  downloadJsonBackup,
  exportRecordsToExcelCsv,
  parseAndValidateBackupJson,
} from '../utils/storage';
import { ConfirmModal } from './ConfirmModal';

interface SyncBackupViewProps {
  year: number;
  month: number;
  state: AppDataState;
  onRestoreState: (nextState: AppDataState) => void;
  onUpdateSheetMeta: (meta: {
    googleSheetId: string;
    googleSheetUrl: string;
    googleSheetName: string;
    lastGoogleSyncAt: string;
  }) => void;
}

type PendingAction =
  | { type: 'import_local_json'; nextState: AppDataState; fileName: string }
  | { type: 'update_sheet'; spreadsheetId: string; title: string }
  | { type: 'overwrite_drive_json'; file: DriveFileItem }
  | { type: 'restore_drive_json'; file: DriveFileItem }
  | { type: 'delete_drive_file'; file: DriveFileItem };

export const SyncBackupView: React.FC<SyncBackupViewProps> = ({
  year,
  month,
  state,
  onRestoreState,
  onUpdateSheetMeta,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [busyAction, setBusyAction] = useState<string>('');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (authUser, token) => {
        setUser(authUser);
        setNeedsAuth(!token);
        if (token) {
          refreshDriveFiles(token);
        }
      },
      (authUser) => {
        setUser(authUser);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
  };

  const refreshDriveFiles = async (explicitToken?: string) => {
    const token = explicitToken || getWorkspaceAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyAction('list');
    try {
      const files = await listAppDriveFiles(token);
      setDriveFiles(files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดรายการไฟล์จาก Google Drive ได้';
      if (msg === 'AUTH_EXPIRED') {
        setNeedsAuth(true);
        showMessage('error', 'เซสชัน Google หมดอายุ กรุณากด Sign in with Google เพื่อเชื่อมต่ออีกครั้ง');
      } else {
        showMessage('error', msg);
      }
    } finally {
      setBusyAction('');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const res = await signInWithGoogleWorkspace();
      setUser(res.user);
      setNeedsAuth(false);
      await refreshDriveFiles(res.accessToken);
      showMessage('success', `เชื่อมต่อบัญชี ${res.user.email || res.user.displayName} เรียบร้อยแล้ว`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'การเข้าสู่ระบบไม่สำเร็จ';
      showMessage('error', msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleWorkspace();
    setUser(null);
    setNeedsAuth(true);
    setDriveFiles([]);
    showMessage('success', 'ออกจากระบบ Google Workspace แล้ว');
  };

  const handleCreateNewSheet = async () => {
    const token = getWorkspaceAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyAction('create_sheet');
    try {
      const created = await createAndSyncSpreadsheet(token, state, year);
      onUpdateSheetMeta({
        googleSheetId: created.spreadsheetId,
        googleSheetUrl: created.spreadsheetUrl,
        googleSheetName: created.title,
        lastGoogleSyncAt: new Date().toISOString(),
      });
      await refreshDriveFiles(token);
      showMessage('success', `สร้างและซิงค์ข้อมูลลง Google Sheet "${created.title}" เรียบร้อยแล้ว`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'สร้าง Google Sheet ไม่สำเร็จ';
      if (msg === 'AUTH_EXPIRED') setNeedsAuth(true);
      showMessage('error', msg === 'AUTH_EXPIRED' ? 'กรุณา Sign in with Google อีกครั้ง' : msg);
    } finally {
      setBusyAction('');
    }
  };

  const handleUploadNewDriveBackup = async () => {
    const token = getWorkspaceAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyAction('upload_drive');
    try {
      const uploaded = await uploadJsonBackupToDrive(token, state);
      await refreshDriveFiles(token);
      showMessage('success', `สำรองข้อมูลไฟล์ "${uploaded.name}" ขึ้น Google Drive เรียบร้อยแล้ว`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'อัปโหลดไปยัง Google Drive ไม่สำเร็จ';
      if (msg === 'AUTH_EXPIRED') setNeedsAuth(true);
      showMessage('error', msg === 'AUTH_EXPIRED' ? 'กรุณา Sign in with Google อีกครั้ง' : msg);
    } finally {
      setBusyAction('');
    }
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAndValidateBackupJson(text);
      setPendingAction({
        type: 'import_local_json',
        nextState: parsed,
        fileName: file.name,
      });
    } catch (err: unknown) {
      showMessage(
        'error',
        err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ JSON ได้'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'import_local_json') {
      onRestoreState(pendingAction.nextState);
      showMessage('success', `นำเข้าข้อมูลจาก "${pendingAction.fileName}" สำเร็จ`);
      setPendingAction(null);
      return;
    }

    const token = getWorkspaceAccessToken();
    if (!token) {
      setNeedsAuth(true);
      setPendingAction(null);
      return;
    }

    setBusyAction('confirming');
    try {
      if (pendingAction.type === 'update_sheet') {
        const res = await syncExistingSpreadsheet(
          token,
          pendingAction.spreadsheetId,
          state,
          year
        );
        onUpdateSheetMeta({
          googleSheetId: pendingAction.spreadsheetId,
          googleSheetUrl:
            state.settings.googleSheetUrl ||
            `https://docs.google.com/spreadsheets/d/${pendingAction.spreadsheetId}`,
          googleSheetName: res.title,
          lastGoogleSyncAt: new Date().toISOString(),
        });
        showMessage('success', `อัปเดตข้อมูลไปยัง "${res.title}" เรียบร้อยแล้ว`);
      } else if (pendingAction.type === 'overwrite_drive_json') {
        const updated = await uploadJsonBackupToDrive(token, state, pendingAction.file.id);
        await refreshDriveFiles(token);
        showMessage('success', `เขียนทับไฟล์สำรอง "${updated.name}" บน Google Drive สำเร็จ`);
      } else if (pendingAction.type === 'restore_drive_json') {
        const restored = await restoreBackupFromDrive(token, pendingAction.file.id);
        onRestoreState(restored);
        showMessage('success', `กู้คืนข้อมูลจาก "${pendingAction.file.name}" บน Google Drive สำเร็จ`);
      } else if (pendingAction.type === 'delete_drive_file') {
        await deleteDriveFile(token, pendingAction.file.id);
        await refreshDriveFiles(token);
        showMessage('success', `ลบไฟล์ "${pendingAction.file.name}" ออกจาก Google Drive แล้ว`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ';
      if (msg === 'AUTH_EXPIRED') setNeedsAuth(true);
      showMessage('error', msg === 'AUTH_EXPIRED' ? 'กรุณา Sign in with Google อีกครั้ง' : msg);
    } finally {
      setBusyAction('');
      setPendingAction(null);
    }
  };

  const jsonBackups = driveFiles.filter((f) => f.mimeType === 'application/json');
  const sheetsFiles = driveFiles.filter(
    (f) => f.mimeType === 'application/vnd.google-apps.spreadsheet'
  );

  const confirmDialogConfig = (() => {
    if (!pendingAction) return null;
    switch (pendingAction.type) {
      case 'import_local_json':
        return {
          title: 'ยืนยันการนำเข้าข้อมูล (.JSON)?',
          description: `ข้อมูลในเครื่องปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์ "${pendingAction.fileName}"`,
          details: [
            `จำนวนวันที่มีบันทึกในไฟล์: ${Object.keys(pendingAction.nextState.days).length} วัน`,
            `เรท OT ในไฟล์: ฿${pendingAction.nextState.settings.defaultOtRate}/ชม.`,
          ],
          confirmLabel: 'กู้คืนข้อมูล',
          tone: 'warning' as const,
        };
      case 'update_sheet':
        return {
          title: 'ยืนยันอัปเดต Google Sheet เดิม?',
          description: `ระบบจะล้างและเขียนทับข้อมูลในแท็บ "รายการโอทีรายวัน", "สรุปรอบตัดวีค" และ "สรุปรายปี_12_เดือน" ของสเปรดชีต "${pendingAction.title}"`,
          details: [
            `จำนวนวันที่มีข้อมูล: ${Object.keys(state.days).length} วัน`,
            `สรุปปี: ${year + 543} (${year})`,
          ],
          confirmLabel: 'อัปเดตสเปรดชีต',
          tone: 'primary' as const,
        };
      case 'overwrite_drive_json':
        return {
          title: 'ยืนยันเขียนทับไฟล์สำรองบน Google Drive?',
          description: `ไฟล์ "${pendingAction.file.name}" บน Google Drive จะถูกแทนที่ด้วยข้อมูลปัจจุบันของคุณ`,
          confirmLabel: 'เขียนทับไฟล์',
          tone: 'warning' as const,
        };
      case 'restore_drive_json':
        return {
          title: 'ยืนยันกู้คืนข้อมูลจาก Google Drive?',
          description: `ข้อมูลในเครื่องปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์ "${pendingAction.file.name}" บน Google Drive`,
          confirmLabel: 'กู้คืนข้อมูล',
          tone: 'warning' as const,
        };
      case 'delete_drive_file':
        return {
          title: 'ยืนยันลบไฟล์จาก Google Drive?',
          description: `คุณต้องการลบไฟล์ "${pendingAction.file.name}" ออกจาก Google Drive อย่างถาวรหรือไม่?`,
          confirmLabel: 'ลบไฟล์',
          tone: 'danger' as const,
        };
    }
  })();

  return (
    <div className="space-y-6 max-w-4xl">
      {statusMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Local Excel CSV & JSON Backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Excel CSV */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ส่งออกไฟล์ Excel (.CSV ภาษาไทยไม่เพี้ยน)
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                เข้ารหัส UTF-8 พร้อม BOM เปิดใน Microsoft Excel ได้ทันทีโดยสระและตัวอักษรไทยไม่เพี้ยน
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => exportRecordsToExcelCsv(state.days, year, month)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>เดือน {month}/{year + 543}</span>
            </button>
            <button
              type="button"
              onClick={() => exportRecordsToExcelCsv(state.days, year)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>ทั้งปี {year + 543}</span>
            </button>
            <button
              type="button"
              onClick={() => exportRecordsToExcelCsv(state.days)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>ข้อมูลทั้งหมด</span>
            </button>
          </div>
        </div>

        {/* Local JSON Backup & Restore */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <FolderSync className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                สำรอง / กู้คืนข้อมูลในเครื่อง (.JSON)
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                สำรองบันทึกทั้งหมด การตั้งค่าเรท รอบตัดวีค และรายการปรับปรุงเป็นไฟล์ .JSON
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => downloadJsonBackup(state)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>ดาวน์โหลด .JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleLocalFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>นำเข้าไฟล์ .JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Google Workspace: Google Sheets & Google Drive */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              เชื่อมต่อ Google Sheets และ Google Drive
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ซิงค์ตาราง OT และสรุปรอบตัดวีคลง Google Sheets หรือสำรองไฟล์ .JSON ขึ้น Google Drive
            </p>
          </div>

          {needsAuth ? (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingIn}
              className="gsi-material-button shrink-0"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                  {user?.displayName || 'เชื่อมต่อแล้ว'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {user?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>

        {!needsAuth ? (
          <div className="space-y-6">
            {/* Action Buttons Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Google Sheets Box */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Google Sheets (ตารางสรุปรายวัน/รอบ/ปี)
                  </span>
                  {state.settings.googleSheetUrl && (
                    <a
                      href={state.settings.googleSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <span>เปิดชีต</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {state.settings.googleSheetId && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    ชีตที่เชื่อมอยู่: {state.settings.googleSheetName || state.settings.googleSheetId}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={handleCreateNewSheet}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60 transition-colors"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>
                      {busyAction === 'create_sheet' ? 'กำลังสร้างชีต...' : 'สร้าง Google Sheet ใหม่'}
                    </span>
                  </button>
                  {state.settings.googleSheetId && (
                    <button
                      type="button"
                      disabled={!!busyAction}
                      onClick={() =>
                        setPendingAction({
                          type: 'update_sheet',
                          spreadsheetId: state.settings.googleSheetId!,
                          title: state.settings.googleSheetName || 'OT & Wage Ledger',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>อัปเดตชีตเดิม</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Google Drive Backup Box */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Google Drive (ไฟล์สำรองข้อมูล .JSON)
                  </span>
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={() => refreshDriveFiles()}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  >
                    <RefreshCw className={`h-3 w-3 ${busyAction === 'list' ? 'animate-spin' : ''}`} />
                    <span>รีเฟรช</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  เก็บไฟล์สำรองบน Google Drive ส่วนตัว เพื่อกู้คืนข้ามอุปกรณ์ได้ทุกเมื่อ
                </p>
                <div>
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={handleUploadNewDriveBackup}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-60 transition-colors"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    <span>
                      {busyAction === 'upload_drive' ? 'กำลังอัปโหลด...' : 'สำรองขึ้น Drive ใหม่'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Drive File Lists */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ไฟล์ใน Google Drive ที่สร้างจากแอปนี้ ({driveFiles.length})
              </h4>

              {driveFiles.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                  ยังไม่มีไฟล์ที่สร้างจากแอปนี้บน Google Drive
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                  {[...sheetsFiles, ...jsonBackups].map((file) => {
                    const isSheet = file.mimeType === 'application/vnd.google-apps.spreadsheet';
                    const modDate = new Date(file.modifiedTime).toLocaleString('th-TH');
                    return (
                      <div
                        key={file.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {file.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{isSheet ? 'Google Sheets' : 'JSON Backup'}</span>
                            <span className="mx-1.5" aria-hidden="true">·</span>
                            <span className="font-mono">{modDate}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSheet ? (
                            <>
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  เปิดชีต
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingAction({
                                    type: 'update_sheet',
                                    spreadsheetId: file.id,
                                    title: file.name,
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700"
                              >
                                ซิงค์ทับชีตนี้
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingAction({ type: 'restore_drive_json', file })
                                }
                                className="px-2.5 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700"
                              >
                                กู้คืน
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingAction({ type: 'overwrite_drive_json', file })
                                }
                                className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                เขียนทับ
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({ type: 'delete_drive_file', file })
                            }
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40"
                            aria-label={`ลบ ${file.name}`}
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
        ) : (
          <div className="py-4 text-xs text-slate-500 dark:text-slate-400">
            กดปุ่ม <strong>Sign in with Google</strong> ด้านบนเพื่อสร้างสเปรดชีต Google Sheets หรือสำรองข้อมูลลง Google Drive ส่วนตัวของคุณ
          </div>
        )}
      </div>

      {confirmDialogConfig && (
        <ConfirmModal
          open={!!pendingAction}
          title={confirmDialogConfig.title}
          description={confirmDialogConfig.description}
          details={confirmDialogConfig.details}
          confirmLabel={confirmDialogConfig.confirmLabel}
          tone={confirmDialogConfig.tone}
          isLoading={busyAction === 'confirming'}
          onConfirm={executePendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};
