import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  Eye,
  HardDrive,
  HardDriveDownload,
  KeyRound,
  Lightbulb,
  Lock,
  Moon,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sun,
  Type,
  Upload,
  User,
  Vibrate,
} from 'lucide-react';
import { prefetchAllOfflineData } from '../lib/dataLoader';
import {
  checkAndApplyPwaUpdate,
  getPwaState,
  getStorageInfo,
  isNativeApp,
  requestPersistentStorage,
  subscribePwaState,
  triggerPwaInstall,
  type PwaState,
} from '../lib/pwa';
import {
  exportProgressJSON,
  getLastBackupAt,
  markBackupDone,
  parseBackupJSON,
} from '../lib/storage';
import {
  APP_VERSION,
  checkForAppUpdate,
  type UpdateCheckResult,
} from '../lib/updater';
import type { ManifestData, UserProgress } from '../lib/types';

interface SettingsPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onUpdateSettings: (patch: Partial<UserProgress['settings']>) => void;
  onImportProgress: (next: UserProgress) => void;
  onResetProgress: () => void;
  onLockNow: () => void;
  registerBackHandler?: (fn: (() => boolean) | null) => void;
  onBack: () => void;
}

function SwitchRow({
  icon: Icon,
  iconColor,
  title,
  desc,
  checked,
  onToggle,
  dark,
}: {
  icon: typeof Eye;
  iconColor: string;
  title: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
  dark: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`mt-0.5 rounded-xl p-2 ${dark ? 'bg-slate-800' : 'bg-slate-100'} ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-snug">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-400 leading-snug">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-300'
        }`}
        aria-pressed={checked}
      >
        <div
          className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage({
  manifest,
  progress,
  onUpdateSettings,
  onImportProgress,
  onResetProgress,
  onLockNow,
  registerBackHandler,
  onBack,
}: SettingsPageProps) {
  const dark = progress.settings.darkMode;
  const nativeApp = isNativeApp();
  const [newPin, setNewPin] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState('');
  const [offlineState, setOfflineState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [offlineMsg, setOfflineMsg] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [pwaState, setPwaState] = useState<PwaState>(() => getPwaState());
  const [installingPwa, setInstallingPwa] = useState(false);
  const [pwaUpdateMsg, setPwaUpdateMsg] = useState('');
  const [storageInfo, setStorageInfo] = useState<{
    persisted: boolean;
    usageMb: number | null;
    quotaMb: number | null;
  }>({ persisted: false, usageMb: null, quotaMb: null });
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastBackupAt());
  const [backupStatusMsg, setBackupStatusMsg] = useState('');
  const [backupErrorMsg, setBackupErrorMsg] = useState('');
  const [pendingImport, setPendingImport] = useState<{
    progress: UserProgress;
    exportedAt?: string;
    answeredCount: number;
    xp: number;
  } | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2 | 3>(0);
  const [resetDoneMsg, setResetDoneMsg] = useState('');

  useEffect(() => {
    const unsub = subscribePwaState(setPwaState);
    getStorageInfo().then(setStorageInfo).catch(() => {});
    return unsub;
  }, []);

  useEffect(() => {
    if (!registerBackHandler) return;
    registerBackHandler(() => {
      if (pendingImport) {
        setPendingImport(null);
        return true;
      }
      if (resetStep > 0) {
        setResetStep(0);
        return true;
      }
      return false;
    });
    return () => registerBackHandler(null);
  }, [registerBackHandler, resetStep, pendingImport]);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setPwaUpdateMsg('');
    try {
      if (nativeApp) {
        const res = await checkForAppUpdate();
        setUpdateResult(res);
      } else {
        const res = await checkAndApplyPwaUpdate();
        setPwaUpdateMsg(res.message);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallPwa = async () => {
    setInstallingPwa(true);
    try {
      await triggerPwaInstall();
    } finally {
      setInstallingPwa(false);
    }
  };

  const handleRequestPersist = async () => {
    await requestPersistentStorage();
    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  const cardCls = `rounded-2xl border p-4 space-y-2 ${
    dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
  }`;

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPin.trim();
    if (!/^\d{4,8}$/.test(clean)) {
      setPinSavedMsg('PIN harus berupa 4–8 digit angka.');
      return;
    }
    localStorage.setItem('ws_pin_v1', clean);
    setNewPin('');
    setPinSavedMsg('PIN baru berhasil disimpan!');
  };

  const handleDownloadOffline = async () => {
    setOfflineState('loading');
    try {
      const res = await prefetchAllOfflineData((done, total, label) => {
        setOfflineMsg(`Mengunduh ${done}/${total}: ${label}...`);
      });
      setOfflineState('done');
      setOfflineMsg(
        `Tersimpan offline! ${res.questions.toLocaleString()} soal, ${res.flashcards} flashcard, & ${res.images} gambar siap tanpa kuota.`
      );
    } catch {
      setOfflineState('idle');
      setOfflineMsg('Sebagian file gagal diunduh, pastikan internet aktif.');
    }
  };

  const backupFileName = () => `backup-studypro-${new Date().toISOString().slice(0, 10)}.json`;

  const handleExport = () => {
    setBackupErrorMsg('');
    const json = exportProgressJSON(progress);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const iso = markBackupDone();
    setLastBackupAt(iso);
    setBackupStatusMsg(
      `✅ File backup (${Object.keys(progress.srs).length} soal, ${progress.xp} XP) berhasil diunduh ke folder Download HP!`
    );
  };

  const canWebShareFile = (() => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
    try {
      const testFile = new File(['{}'], 'test.json', { type: 'application/json' });
      return Boolean(navigator.canShare?.({ files: [testFile] }));
    } catch {
      return false;
    }
  })();

  const handleShareBackup = async () => {
    setBackupErrorMsg('');
    try {
      const json = exportProgressJSON(progress);
      const file = new File([json], backupFileName(), { type: 'application/json' });
      await navigator.share({
        title: 'Backup Data Study Pro',
        text: `Cadangan progres belajar (${Object.keys(progress.srs).length} soal, ${progress.xp} XP).`,
        files: [file],
      });
      const iso = markBackupDone();
      setLastBackupAt(iso);
      setBackupStatusMsg('✅ File backup berhasil dibagikan/disimpan.');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setBackupErrorMsg('Gagal membuka menu bagikan. Gunakan tombol Download Backup Lokal.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupErrorMsg('');
    setBackupStatusMsg('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBackupJSON(String(reader.result || ''));
      if (parsed) {
        setPendingImport(parsed);
      } else {
        setBackupErrorMsg('File backup tidak valid atau rusak. Pastikan memilih file .json dari Study Pro.');
      }
    };
    reader.readAsText(file);
  };

  const confirmPendingImport = () => {
    if (!pendingImport) return;
    onImportProgress(pendingImport.progress);
    setBackupStatusMsg(
      `✅ Progres belajar (${pendingImport.answeredCount} soal, ${pendingImport.xp} XP) berhasil dipulihkan!`
    );
    setPendingImport(null);
  };

  const handleReset = () => {
    setResetDoneMsg('');
    setResetStep(1);
  };

  const handleConfirmResetStep = () => {
    if (resetStep === 1) {
      setResetStep(2);
    } else if (resetStep === 2) {
      setResetStep(3);
    } else if (resetStep === 3) {
      onResetProgress();
      setResetStep(0);
      setResetDoneMsg('✅ Semua progres belajar berhasil di-reset ke awal!');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
            dark ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
          }`}
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400">
          Pengaturan
        </h2>
      </div>

      {/* Section 0: Install Aplikasi di HP (Chrome Android PWA) */}
      {!nativeApp && (
        <section className={cardCls}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Install Aplikasi di HP
            </p>
            <span className="rounded-lg bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
              Chrome Web App
            </span>
          </div>

          {pwaState.isStandalone ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2.5 text-xs font-bold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Terpasang sebagai Aplikasi di HP (Mode Layar Penuh)</span>
            </div>
          ) : pwaState.canInstall ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Pasang langsung ke Layar Utama HP lewat Chrome — tampil layar penuh tanpa bar browser dan bisa dibuka offline tanpa download APK.
              </p>
              <button
                type="button"
                disabled={installingPwa}
                onClick={handleInstallPwa}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow active:scale-[0.99] disabled:opacity-60"
              >
                <Smartphone className="h-4 w-4" />
                {installingPwa ? 'Membuka Dialog Install...' : 'Install Study Pro ke Layar Utama'}
              </button>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-3 text-[11px] leading-relaxed ${
                dark ? 'border-slate-700 bg-slate-950/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <p className="font-bold text-emerald-400 mb-1">Cara Install di Chrome Android:</p>
              <p>
                Buka halaman ini di <strong>Chrome Android</strong>, ketuk ikon menu{' '}
                <strong>⋮</strong> (pojok kanan atas) → pilih{' '}
                <strong>Tambahkan ke layar utama / Install app</strong> untuk memasang tanpa file APK.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Section 0b: Pembaruan Aplikasi */}
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            {nativeApp ? 'Pembaruan Aplikasi (APK)' : 'Pembaruan Aplikasi (Web App)'}
          </p>
          <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
            v{APP_VERSION}
          </span>
        </div>

        {nativeApp ? (
          <>
            <SwitchRow
              icon={ArrowUpCircle}
              iconColor="text-emerald-400"
              title="Cek Update Otomatis Saat Dibuka"
              desc="Periksa rilis APK terbaru secara berkala saat HP terhubung ke internet."
              checked={progress.settings.autoCheckUpdates}
              onToggle={() =>
                onUpdateSettings({ autoCheckUpdates: !progress.settings.autoCheckUpdates })
              }
              dark={dark}
            />

            <button
              type="button"
              disabled={checkingUpdate}
              onClick={handleCheckUpdate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 active:scale-[0.99]"
            >
              <RefreshCw className={`h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              {checkingUpdate ? 'Memeriksa Versi Terbaru...' : 'Cek Pembaruan Sekarang'}
            </button>

            {updateResult && updateResult.status === 'update_available' && (
              <div className="mt-2 space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="text-xs font-extrabold text-emerald-300">
                  🎉 Versi Baru Tersedia: v{updateResult.latestVersion}
                </p>
                {updateResult.notes && (
                  <p className="text-[11px] text-slate-300 whitespace-pre-line">{updateResult.notes}</p>
                )}
                <a
                  href={updateResult.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow"
                >
                  <Download className="h-4 w-4" /> Download & Install Update (.apk)
                </a>
              </div>
            )}

            {updateResult && updateResult.status === 'up_to_date' && (
              <div className="mt-1 flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <span>✅ Aplikasi sudah versi terbaru (v{updateResult.currentVersion})</span>
                {updateResult.downloadUrl && (
                  <a
                    href={updateResult.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-[11px]"
                  >
                    Unduh Ulang
                  </a>
                )}
              </div>
            )}

            {updateResult && updateResult.status === 'error' && (
              <p className="mt-1 text-[11px] text-amber-400">{updateResult.error}</p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pembaruan otomatis terunduh saat dibuka online — tidak perlu download atau install ulang file APK.
            </p>
            <button
              type="button"
              disabled={checkingUpdate}
              onClick={handleCheckUpdate}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-extrabold text-white disabled:opacity-60 active:scale-[0.99]"
            >
              <RefreshCw className={`h-4 w-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              {checkingUpdate ? 'Memeriksa Update Web...' : 'Cek & Terapkan Update Sekarang'}
            </button>
            {pwaUpdateMsg && (
              <p className="text-[11px] font-semibold text-emerald-300">{pwaUpdateMsg}</p>
            )}
          </div>
        )}
      </section>

      {/* Section 1: Penyimpanan Data & Backup Lokal */}
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Penyimpanan Data & Backup Lokal
          </p>
          {storageInfo.persisted ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Penyimpanan Permanen Aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              <HardDrive className="h-3 w-3" /> Lokal HP
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
          {[
            { label: 'Soal', val: Object.keys(progress.srs).length },
            { label: 'XP', val: progress.xp },
            { label: 'Bookmark', val: progress.bookmarks.length },
            { label: 'Catatan', val: Object.keys(progress.notes).length },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-xl px-2 py-2 ${dark ? 'bg-slate-950/70' : 'bg-slate-100'}`}
            >
              <p className="text-sm font-black text-emerald-400">{item.val.toLocaleString()}</p>
              <p className="text-[10px] font-semibold text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Backup terakhir:{' '}
            <strong className={dark ? 'text-slate-200' : 'text-slate-700'}>
              {lastBackupAt
                ? new Date(lastBackupAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Belum pernah download backup lokal'}
            </strong>
          </span>
          {!storageInfo.persisted && (
            <button
              type="button"
              onClick={handleRequestPersist}
              className="shrink-0 text-[10px] font-bold text-cyan-400 underline"
            >
              Aktifkan Proteksi Data
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow active:scale-[0.99]"
        >
          <Download className="h-4 w-4" /> Download Backup Lokal (.json)
        </button>

        <div className={`grid gap-2 ${canWebShareFile ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-xs font-bold">
            <Upload className="h-3.5 w-3.5" /> Pulihkan Backup (.json)
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
          {canWebShareFile && (
            <button
              type="button"
              onClick={handleShareBackup}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-xs font-bold"
            >
              <Share2 className="h-3.5 w-3.5" /> Bagikan / Simpan Drive
            </button>
          )}
        </div>

        {pendingImport && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-bold text-amber-300">
              Pulihkan backup{' '}
              {pendingImport.exportedAt
                ? `dari ${new Date(pendingImport.exportedAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}`
                : 'ini'}
              ?
            </p>
            <p className="text-[11px] text-slate-300">
              ({pendingImport.answeredCount.toLocaleString()} soal, {pendingImport.xp.toLocaleString()} XP) — Ini akan menimpa progres saat ini.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="rounded-lg border border-slate-700 py-1.5 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmPendingImport}
                className="rounded-lg bg-emerald-600 py-1.5 text-xs font-extrabold text-white"
              >
                Ya, Pulihkan
              </button>
            </div>
          </div>
        )}

        {backupStatusMsg && (
          <p className="text-[11px] font-semibold text-emerald-400">{backupStatusMsg}</p>
        )}
        {backupErrorMsg && (
          <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {backupErrorMsg}
          </p>
        )}

        <div className="border-t border-slate-800/50 pt-2 space-y-2">
          <button
            disabled={offlineState === 'loading'}
            onClick={handleDownloadOffline}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-extrabold text-cyan-300 disabled:opacity-60"
          >
            {offlineState === 'done' ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Tersimpan Offline ({manifest.totalQuestions.toLocaleString()} Soal)
              </>
            ) : offlineState === 'loading' ? (
              'Menyimpan Data Offline...'
            ) : (
              <>
                <HardDriveDownload className="h-4 w-4" /> Simpan Semua Data Offline Sekarang
              </>
            )}
          </button>
          {offlineMsg && <p className="text-[11px] text-emerald-300">{offlineMsg}</p>}

          <button
            type="button"
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-400"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Semua Progress Belajar
          </button>
          {resetDoneMsg && <p className="text-[11px] font-semibold text-emerald-400">{resetDoneMsg}</p>}
        </div>
      </section>

      {/* Section 1: Mode Latihan & Soal */}
      <section className={cardCls}>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Mode Latihan & Soal
        </p>

        <SwitchRow
          icon={Eye}
          iconColor="text-emerald-400"
          title="Sembunyikan Opsi A–E Dulu (Active Recall)"
          desc="Matikan jika ingin pilihan A–E langsung tampil saat soal dibuka."
          checked={progress.settings.activeRecallDefault}
          onToggle={() =>
            onUpdateSettings({ activeRecallDefault: !progress.settings.activeRecallDefault })
          }
          dark={dark}
        />

        <div className="border-t border-slate-800/50" />

        <SwitchRow
          icon={Lightbulb}
          iconColor="text-cyan-400"
          title="Tampilkan Kata Kunci Klinis Otomatis"
          desc="Langsung tampilkan sorotan kata kunci soal tanpa klik tombol Intip."
          checked={progress.settings.showKeywordsHint}
          onToggle={() =>
            onUpdateSettings({ showKeywordsHint: !progress.settings.showKeywordsHint })
          }
          dark={dark}
        />

        <div className="border-t border-slate-800/50" />

        <div className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${dark ? 'bg-slate-800' : 'bg-slate-100'} text-amber-400`}>
              <Type className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Ukuran Teks Soal</p>
              <p className="text-[11px] text-slate-400">Atur kenyamanan baca di layar HP</p>
            </div>
          </div>
          <div className={`flex rounded-xl p-1 ${dark ? 'bg-slate-950' : 'bg-slate-100'}`}>
            {(['normal', 'large'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onUpdateSettings({ fontSize: sz })}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  progress.settings.fontSize === sz
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400'
                }`}
              >
                {sz === 'normal' ? 'Normal' : 'Besar'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Tampilan & Profil */}
      <section className={cardCls}>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Tampilan & Profil
        </p>

        <div className="flex items-center justify-between gap-3 py-1.5">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${dark ? 'bg-slate-800' : 'bg-slate-100'} text-cyan-400`}>
              <User className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold">Nama Panggilan</span>
          </div>
          <input
            type="text"
            value={progress.settings.userName}
            onChange={(e) => onUpdateSettings({ userName: e.target.value })}
            className={`w-40 rounded-xl border px-3 py-1.5 text-xs font-semibold text-right ${
              dark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
            }`}
          />
        </div>

        <div className="border-t border-slate-800/50" />

        <SwitchRow
          icon={dark ? Moon : Sun}
          iconColor="text-amber-400"
          title="Tema Gelap (Dark Mode)"
          desc="Lebih nyaman di mata saat belajar malam hari."
          checked={dark}
          onToggle={() => onUpdateSettings({ darkMode: !dark })}
          dark={dark}
        />

        <div className="border-t border-slate-800/50" />

        <SwitchRow
          icon={Vibrate}
          iconColor="text-violet-400"
          title="Getar Haptic Feedback Android"
          desc="Getaran singkat saat memilih jawaban."
          checked={progress.settings.haptics}
          onToggle={() => onUpdateSettings({ haptics: !progress.settings.haptics })}
          dark={dark}
        />
      </section>

      {/* Section 3: Privasi & Kunci Layar */}
      <section className={cardCls}>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Privasi & Kunci Layar
        </p>

        <form onSubmit={handleSavePin} className="space-y-2 py-1">
          <div className="flex items-center gap-2">
            <div className={`rounded-xl p-2 ${dark ? 'bg-slate-800' : 'bg-slate-100'} text-rose-400`}>
              <KeyRound className="h-4 w-4" />
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value);
                setPinSavedMsg('');
              }}
              placeholder="Ganti PIN baru (4–8 angka)"
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                dark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white"
            >
              Simpan
            </button>
          </div>
          {pinSavedMsg && <p className="text-[11px] text-emerald-400">{pinSavedMsg}</p>}
        </form>

        <button
          type="button"
          onClick={onLockNow}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-xs font-bold hover:border-rose-500/40"
        >
          <Lock className="h-3.5 w-3.5" /> Kunci Layar Sekarang (Mode Samaran)
        </button>
      </section>

      {/* 3-Step Reset Progress Confirmation Modal */}
      {resetStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-xs space-y-4 rounded-3xl border p-5 text-center shadow-2xl ${
              dark ? 'border-rose-500/40 bg-slate-900 text-slate-100' : 'border-rose-200 bg-white text-slate-900'
            }`}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                Konfirmasi {resetStep} / 3
              </p>
              <h3 className="mt-1 text-base font-black">
                {resetStep === 1
                  ? 'Are you really sure?'
                  : resetStep === 2
                  ? 'Are you really really sure?'
                  : 'Yakin pesan mau reset?'}
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                {resetStep === 1
                  ? 'Semua progres belajar, XP, streak, dan jadwal SRS kamu akan dihapus.'
                  : resetStep === 2
                  ? 'Data yang terhapus tidak bisa kembali kecuali kamu sudah Export Backup JSON.'
                  : 'Ini konfirmasi terakhir. Ketuk tombol merah di bawah untuk reset seluruh progres ke 0.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setResetStep(0)}
                className={`rounded-xl border py-2.5 text-xs font-bold ${
                  dark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-300 bg-slate-100 text-slate-700'
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetStep}
                className="rounded-xl bg-rose-600 py-2.5 text-xs font-extrabold text-white shadow active:scale-[0.98]"
              >
                {resetStep === 1
                  ? 'Ya, Lanjut'
                  : resetStep === 2
                  ? 'Really Sure!'
                  : 'YA, RESET SEMUA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
