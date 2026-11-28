import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  HardDriveDownload,
  Settings,
} from 'lucide-react';
import { prefetchAllOfflineData } from '../lib/dataLoader';
import { computeOverallReadiness, ENTRANCE_QUESTIONS_PER_SPECIALTY } from '../lib/motivation';
import { computeSpecialtyStats } from '../lib/srs';
import type { ManifestData, UserProgress } from '../lib/types';

interface StatsPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onOpenSettings: () => void;
  onStartEntranceTest: () => void;
  onStartSpecialtyWeak: (specialtyId: string) => void;
}

export function StatsPage({
  manifest,
  progress,
  onOpenSettings,
  onStartEntranceTest,
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
            <p className="text-xl font-black text-emerald-400">
              {readiness.isReadinessReady ? `${readiness.weightedAccuracy}%` : '—%'}
            </p>
            <p className="text-[10px] text-slate-400">
              {readiness.isReadinessReady
                ? 'Kesiapan Adaptif'
                : `Siap ${readiness.readySpecialtiesCount}/${readiness.totalSpecialties} bidang`}
            </p>
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
        {readiness.isReadinessReady ? (
          <div className="mt-2.5 space-y-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px]">
            {readiness.baselineAccuracy !== null && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300">
                  Baseline Entrance Test: <strong>{readiness.baselineAccuracy}%</strong>
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                    (readiness.deltaFromBaseline || 0) > 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : (readiness.deltaFromBaseline || 0) < 0
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-700/60 text-slate-300'
                  }`}
                >
                  {(readiness.deltaFromBaseline || 0) > 0
                    ? `+${readiness.deltaFromBaseline}% dr baseline`
                    : (readiness.deltaFromBaseline || 0) < 0
                    ? `${readiness.deltaFromBaseline}% dr baseline`
                    : 'Sama dengan baseline'}
                </span>
              </div>
            )}
            <p className="text-emerald-200/85">
              Angka kesiapan terus beradaptasi otomatis mengikuti hasil latihan &amp; review SRS-mu.
            </p>
          </div>
        ) : (
          <div className="mt-2.5 space-y-2 rounded-xl bg-amber-500/10 border border-amber-500/25 p-3">
            <p className="text-[11px] text-amber-300 leading-relaxed">
              Angka kesiapan baru dikalkulasi setelah mengerjakan Entrance Test ({ENTRANCE_QUESTIONS_PER_SPECIALTY} soal acak/bidang) atau minimal {readiness.minPerSpecialty} soal di masing-masing bidang ({readiness.readySpecialtiesCount}/{readiness.totalSpecialties} bidang terpenuhi).
            </p>
            <button
              type="button"
              onClick={onStartEntranceTest}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-xs font-extrabold text-white shadow"
            >
              <ClipboardCheck className="h-4 w-4" />
              {readiness.entranceAnswered > 0
                ? `Lanjutkan Entrance Test (${readiness.entranceAnswered}/${readiness.entranceTotal})`
                : `Mulai Entrance Test Baseline (${ENTRANCE_QUESTIONS_PER_SPECIALTY} Soal/Bidang)`}
            </button>
          </div>
        )}
      </section>

      {/* 18 Specialty Breakdown */}
      <section
        className={`rounded-2xl border p-4 space-y-2.5 ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Progres &amp; Kesiapan Adaptif Per Bidang (Tap untuk Latihan)
        </h3>
        <div className="space-y-2">
          {manifest.specialties.map((s) => {
            const st = specStats[s.id];
            const solved = st?.uniqueSolved || 0;
            const remaining = Math.max(0, readiness.minPerSpecialty - solved);
            const adaptivePct = readiness.adaptiveBySpecialty[s.id] ?? st?.accuracy ?? 0;
            const basePct = progress.entranceTest?.baselineBySpecialty?.[s.id];
            return (
              <div
                key={s.id}
                onClick={() => onStartSpecialtyWeak(s.id)}
                className="cursor-pointer space-y-1 rounded-xl p-1.5 hover:bg-slate-800/30"
              >
                <div className="flex justify-between text-xs gap-2">
                  <span className="font-bold">{s.shortName}</span>
                  <span className="text-slate-400 text-[11px] text-right">
                    {(readiness.isReadinessReady ? solved > 0 : solved >= readiness.minPerSpecialty)
                      ? `✓ ${solved}/${s.questionCount} • Adaptif ${adaptivePct}%${
                          typeof basePct === 'number' ? ` (Base ${basePct}%)` : ''
                        }`
                      : solved > 0
                      ? `${solved}/${s.questionCount} • kurang ${remaining} soal lagi`
                      : `0/${s.questionCount} • butuh ${readiness.minPerSpecialty} soal`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${st?.coveragePct || 0}%`,
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
