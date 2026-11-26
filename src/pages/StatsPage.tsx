import { useState } from 'react';
import {
  CheckCircle2,
  HardDriveDownload,
  Settings,
} from 'lucide-react';
import { prefetchAllOfflineData } from '../lib/dataLoader';
import { computeOverallReadiness } from '../lib/motivation';
import { computeSpecialtyStats } from '../lib/srs';
import type { ManifestData, UserProgress } from '../lib/types';

interface StatsPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onOpenSettings: () => void;
  onStartSpecialtyWeak: (specialtyId: string) => void;
}

export function StatsPage({
  manifest,
  progress,
  onOpenSettings,
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

      {/* Shortcut to Dedicated Settings Page */}
      <button
        onClick={onOpenSettings}
        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
          dark ? 'border-slate-800 bg-slate-900 hover:border-emerald-500/40' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-extrabold">Buka Halaman Pengaturan Lengkap</p>
            <p className="text-[11px] text-slate-400">
              Matikan sembunyikan opsi A–E, ukuran teks, ganti PIN, & backup
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-400">Buka →</span>
      </button>
    </div>
  );
}
