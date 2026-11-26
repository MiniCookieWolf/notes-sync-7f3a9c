import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  HardDriveDownload,
  Moon,
  Sun,
  Upload,
  Vibrate,
} from 'lucide-react';
import { prefetchAllOfflineData } from '../lib/dataLoader';
import { computeOverallReadiness } from '../lib/motivation';
import { computeSpecialtyStats } from '../lib/srs';
import { exportProgressJSON, importProgressJSON } from '../lib/storage';
import type { ManifestData, UserProgress } from '../lib/types';

interface StatsPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onUpdateSettings: (patch: Partial<UserProgress['settings']>) => void;
  onImportProgress: (next: UserProgress) => void;
  onStartSpecialtyWeak: (specialtyId: string) => void;
}

export function StatsPage({
  manifest,
  progress,
  onUpdateSettings,
  onImportProgress,
  onStartSpecialtyWeak,
}: StatsPageProps) {
  const dark = progress.settings.darkMode;
  const readiness = computeOverallReadiness(progress, manifest.specialties);
  const specStats = computeSpecialtyStats(manifest.specialties, progress);

  const [offlineState, setOfflineState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [offlineMsg, setOfflineMsg] = useState('');

  const handleDownloadOffline = async () => {
    setOfflineState('loading');
    try {
      const res = await prefetchAllOfflineData((done, total, label) => {
        setOfflineMsg(`Mengunduh ${done}/${total}: ${label}...`);
      });
      setOfflineState('done');
      setOfflineMsg(
        `Tersimpan offline di HP! ${res.questions.toLocaleString()} soal, ${res.flashcards} flashcard, & ${res.images} gambar klinis siap dibuka tanpa kuota.`
      );
    } catch {
      setOfflineState('idle');
      setOfflineMsg('Sebagian file gagal diunduh, coba pastikan server/internet aktif.');
    }
  };

  const handleExport = () => {
    const json = exportProgressJSON(progress);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-ukmppd-${new Date().toISOString().slice(0, 10)}.json`;
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

  return (
    <div className="space-y-4 pb-6">
      {/* Offline Pack Downloader */}
      <section
        className={`rounded-2xl border p-4 space-y-3 ${
          dark ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <HardDriveDownload className="h-6 w-6 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-extrabold">Simpan Semua Bank Soal Offline di HP</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Sekali klik untuk menyimpan seluruh {manifest.totalQuestions.toLocaleString()} soal, pembahasan, & gambar klinis ke memori HP Android agar bisa dibuka kapan saja tanpa internet.
            </p>
          </div>
        </div>
        <button
          disabled={offlineState === 'loading'}
          onClick={handleDownloadOffline}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white disabled:opacity-60"
        >
          {offlineState === 'done' ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Sudah Tersimpan Offline
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
      </section>

      {/* Overall Readiness Card */}
      <section
        className={`rounded-2xl border p-4 ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Analitik Kesiapan UKMPPD
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-800/40 p-2.5">
            <p className="text-xl font-black text-emerald-400">{readiness.weightedAccuracy}%</p>
            <p className="text-[10px] text-slate-400">Akurasi Terbobot</p>
          </div>
          <div className="rounded-xl bg-slate-800/40 p-2.5">
            <p className="text-xl font-black text-cyan-400">{readiness.attemptedTotal}</p>
            <p className="text-[10px] text-slate-400">Soal Dikuasai</p>
          </div>
          <div className="rounded-xl bg-slate-800/40 p-2.5">
            <p className="text-xl font-black text-amber-400">{readiness.coveragePct}%</p>
            <p className="text-[10px] text-slate-400">Cakupan Bank</p>
          </div>
        </div>
      </section>

      {/* 18 Specialty Breakdown */}
      <section
        className={`rounded-2xl border p-4 space-y-2.5 ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Akurasi Per Bidang Spesialis (Tap untuk Latihan)
        </h3>
        <div className="space-y-2">
          {manifest.specialties.map((s) => {
            const st = specStats[s.id];
            return (
              <div
                key={s.id}
                onClick={() => onStartSpecialtyWeak(s.id)}
                className="cursor-pointer space-y-1 rounded-xl p-1.5 hover:bg-slate-800/30"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-bold">{s.shortName}</span>
                  <span className="text-slate-400">
                    {st?.attempted ? `${st.accuracy}% (${st.correct}/${st.attempted})` : 'Belum latihan'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${st?.attempted ? st.accuracy : 0}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* App Settings & Backup */}
      <section
        className={`rounded-2xl border p-4 space-y-3 ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Pengaturan & Backup Progress
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Nama Panggilan</span>
          <input
            type="text"
            value={progress.settings.userName}
            onChange={(e) => onUpdateSettings({ userName: e.target.value })}
            className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-right"
          />
        </div>

        <button
          onClick={() => onUpdateSettings({ darkMode: !dark })}
          className="flex w-full items-center justify-between py-1.5 text-xs font-semibold"
        >
          <span className="flex items-center gap-2">
            {dark ? <Moon className="h-4 w-4 text-cyan-400" /> : <Sun className="h-4 w-4 text-amber-400" />}
            Tema Gelap (Nyaman Belajar Malam)
          </span>
          <span className="text-emerald-400 font-bold">{dark ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => onUpdateSettings({ haptics: !progress.settings.haptics })}
          className="flex w-full items-center justify-between py-1.5 text-xs font-semibold"
        >
          <span className="flex items-center gap-2">
            <Vibrate className="h-4 w-4 text-violet-400" />
            Getar Haptic Feedback Android
          </span>
          <span className="text-emerald-400 font-bold">{progress.settings.haptics ? 'ON' : 'OFF'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
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
      </section>
    </div>
  );
}
