import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  HardDriveDownload,
  KeyRound,
  Lightbulb,
  Lock,
  Moon,
  RotateCcw,
  Sun,
  Type,
  Upload,
  User,
  Vibrate,
} from 'lucide-react';
import { prefetchAllOfflineData } from '../lib/dataLoader';
import { exportProgressJSON, importProgressJSON } from '../lib/storage';
import type { ManifestData, UserProgress } from '../lib/types';

interface SettingsPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onUpdateSettings: (patch: Partial<UserProgress['settings']>) => void;
  onImportProgress: (next: UserProgress) => void;
  onResetProgress: () => void;
  onLockNow: () => void;
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
  onBack,
}: SettingsPageProps) {
  const dark = progress.settings.darkMode;
  const [newPin, setNewPin] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState('');
  const [offlineState, setOfflineState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [offlineMsg, setOfflineMsg] = useState('');

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

  const handleExport = () => {
    const json = exportProgressJSON(progress);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-studypro-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importProgressJSON(String(reader.result || ''));
      if (imported) {
        onImportProgress(imported);
        alert('Progress belajar berhasil dipulihkan!');
      } else {
        alert('File backup tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('Yakin reset seluruh XP, streak, riwayat SRS, dan catatan pribadi? Tindakan ini tidak bisa dibatalkan.')) {
      onResetProgress();
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

      {/* Section 4: Data Offline & Backup */}
      <section className={cardCls}>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          Data Offline & Backup
        </p>

        <button
          disabled={offlineState === 'loading'}
          onClick={handleDownloadOffline}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white disabled:opacity-60"
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

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" /> Export Backup
          </button>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2 text-xs font-bold">
            <Upload className="h-3.5 w-3.5" /> Import Backup
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-bold text-rose-400"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset Semua Progress Belajar
        </button>
      </section>
    </div>
  );
}
