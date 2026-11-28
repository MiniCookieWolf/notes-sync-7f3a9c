import {
  ArrowRight,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  Flame,
  Shuffle,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { computeOverallReadiness, ENTRANCE_QUESTIONS_PER_SPECIALTY, getMotivationalPush, getRankInfo } from '../lib/motivation';
import { buildAdaptiveSchedule } from '../lib/scheduler';
import { computeSpecialtyStats, getDueIds } from '../lib/srs';
import { daysBetweenISO, todayISO } from '../lib/storage';
import type { ManifestData, UserProgress } from '../lib/types';

interface HomePageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onStartQuick5: () => void;
  onStartRandom: (count: number) => void;
  onStartDueSrs: () => void;
  onStartWeakest: (specialtyId: string) => void;
  onStartTodayMission: (specialties: string[], targetQ: number) => void;
  onStartEntranceTest: () => void;
  onOpenTab: (tab: 'quiz' | 'planner' | 'library' | 'stats') => void;
}

export function HomePage({
  manifest,
  progress,
  onStartQuick5,
  onStartRandom,
  onStartDueSrs,
  onStartWeakest,
  onStartTodayMission,
  onStartEntranceTest,
  onOpenTab,
}: HomePageProps) {
  const dark = progress.settings.darkMode;
  const today = todayISO();
  const daysLeft = Math.max(0, daysBetweenISO(today, progress.planConfig.examDate));
  const dueIds = getDueIds(progress.srs);
  const specStats = computeSpecialtyStats(manifest.specialties, progress);

  const weakestSpec = [...manifest.specialties].sort(
    (a, b) => (specStats[b.id]?.weakScore || 0) - (specStats[a.id]?.weakScore || 0)
  )[0];

  const readiness = computeOverallReadiness(progress, manifest.specialties);
  const rank = getRankInfo(progress.xp);
  const push = getMotivationalPush(progress, weakestSpec?.shortName || 'Bedah', dueIds.length);
  const schedule = buildAdaptiveSchedule(manifest.specialties, progress);
  const todayMission = schedule.find((d) => d.date === today) || schedule[0];
  const todayLog = progress.dailyLogs[today];
  const answeredToday = todayLog?.answered || 0;
  const missionPct = todayMission
    ? Math.min(100, Math.round((answeredToday / Math.max(1, todayMission.targetQuestions)) * 100))
    : 0;

  return (
    <div className="space-y-4 pb-6">
      {/* Countdown & Readiness Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Lv.{rank.level} {rank.title}
            </span>
            <h2 className="mt-2 text-3xl font-black tracking-tight">H-{daysLeft}</h2>
            <p className="text-xs text-emerald-100/80">
              Target UKMPPD ({progress.planConfig.examDate}) • {progress.xp} XP
            </p>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => (readiness.isReadinessReady ? onOpenTab('stats') : onStartEntranceTest())}
              className="inline-flex flex-col items-center rounded-2xl bg-black/25 px-3.5 py-2 backdrop-blur text-center transition hover:bg-black/35 active:scale-[0.98]"
            >
              <span className="text-[10px] uppercase tracking-wider text-emerald-200">Kesiapan</span>
              <span className="text-2xl font-black">
                {readiness.isReadinessReady
                  ? `${readiness.weightedAccuracy}%`
                  : readiness.entranceAnswered > 0
                  ? `${readiness.entranceAnswered}/${readiness.entranceTotal}`
                  : 'Baseline'}
              </span>
              <span className="text-[10px] text-emerald-200/80">
                {readiness.isReadinessReady
                  ? readiness.deltaFromBaseline !== null && readiness.deltaFromBaseline !== 0
                    ? `${readiness.deltaFromBaseline > 0 ? '+' : ''}${readiness.deltaFromBaseline}% dr baseline`
                    : 'Lulus ≥66%'
                  : 'Entrance Test'}
              </span>
            </button>
          </div>
        </div>

        {/* Streak & Coverage Mini Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/20 p-2.5 text-center backdrop-blur">
          <div>
            <p className="text-sm font-extrabold flex items-center justify-center gap-1">
              <Flame className="h-4 w-4 text-orange-400" />
              {progress.streakDays} hr
            </p>
            <p className="text-[10px] text-emerald-100/75">Streak Aktif</p>
          </div>
          <div>
            <p className="text-sm font-extrabold">{answeredToday} soal</p>
            <p className="text-[10px] text-emerald-100/75">Tuntas Hari Ini</p>
          </div>
          <div>
            <p className="text-sm font-extrabold">{dueIds.length}</p>
            <p className="text-[10px] text-emerald-100/75">Wajib Ulang SRS</p>
          </div>
        </div>
      </section>

      {/* Entrance Test Baseline CTA Card (shown before readiness is unlocked) */}
      {!readiness.isReadinessReady && (
        <section
          className={`rounded-2xl border p-4 space-y-2.5 ${
            dark ? 'border-cyan-500/35 bg-cyan-500/10' : 'border-cyan-200 bg-cyan-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold">
                Entrance Test Baseline ({ENTRANCE_QUESTIONS_PER_SPECIALTY} Soal × {readiness.totalSpecialties} Bidang)
              </h3>
              <p className={`mt-1 text-xs leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                Kerjakan {ENTRANCE_QUESTIONS_PER_SPECIALTY} soal acak dari masing-masing bidang untuk mengukur angka kesiapan awalmu. Bisa dijeda &amp; dilanjutkan kapan saja — setelah selesai, % kesiapan otomatis adaptif mengikuti latihanmu.
              </p>
            </div>
          </div>

          {readiness.entranceAnswered > 0 && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((readiness.entranceAnswered / Math.max(1, readiness.entranceTotal)) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[11px] font-semibold text-cyan-300">
                Progres tersimpan: {readiness.entranceAnswered}/{readiness.entranceTotal} soal dijawab
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onStartEntranceTest}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-extrabold text-white shadow active:scale-[0.99]"
          >
            {readiness.entranceAnswered > 0
              ? `Lanjutkan Entrance Test (${readiness.entranceAnswered}/${readiness.entranceTotal})`
              : `Mulai Entrance Test Baseline (${readiness.totalSpecialties * ENTRANCE_QUESTIONS_PER_SPECIALTY} Soal)`}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* Motivational Push Coach Card */}
      <section
        className={`rounded-2xl border p-4 ${
          dark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold">{push.headline}</h3>
            <p className={`mt-1 text-xs leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
              {push.body}
            </p>
            <button
              onClick={dueIds.length > 0 ? onStartDueSrs : onStartQuick5}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 shadow active:scale-[0.98]"
            >
              {push.cta} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Today's Scheduled Mission */}
      {todayMission && (
        <section
          className={`rounded-2xl border p-4 ${
            dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Misi Jadwal Hari Ini • Fase {todayMission.phase}
              </span>
            </div>
            <button onClick={() => onOpenTab('planner')} className="text-[11px] font-semibold text-cyan-400">
              Atur Jadwal
            </button>
          </div>

          <h4 className="mt-2 text-base font-bold">{todayMission.focusLabel}</h4>
          <p className="mt-0.5 text-xs text-slate-400">
            Target: {todayMission.targetQuestions} soal + {todayMission.targetSrs} review SRS ({todayMission.estimatedMinutes} menit)
          </p>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${missionPct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-400">{missionPct}%</span>
          </div>

          <button
            onClick={() => onStartTodayMission(todayMission.specialties, todayMission.targetQuestions)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20 active:scale-[0.99]"
          >
            Kerjakan Misi Hari Ini <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* Quick Action Grid */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={onStartQuick5}
          className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
            dark ? 'border-slate-800 bg-slate-900 hover:border-emerald-500/40' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <span className="mt-2.5 text-sm font-bold">5 Menit Aja!</span>
          <span className="text-[11px] text-slate-400">3–5 soal kilat anti-mager</span>
        </button>

        <button
          onClick={() => onStartRandom(20)}
          className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
            dark ? 'border-slate-800 bg-slate-900 hover:border-cyan-500/40' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-400">
            <Shuffle className="h-5 w-5" />
          </div>
          <span className="mt-2.5 text-sm font-bold">Random Tiap Saat</span>
          <span className="text-[11px] text-slate-400">Acak dari {manifest.verifiedQuestions.toLocaleString()} soal</span>
        </button>

        <button
          onClick={onStartDueSrs}
          className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
            dark ? 'border-slate-800 bg-slate-900 hover:border-violet-500/40' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="rounded-xl bg-violet-500/15 p-2 text-violet-400">
            <Brain className="h-5 w-5" />
          </div>
          <span className="mt-2.5 text-sm font-bold">Ulangi SRS ({dueIds.length})</span>
          <span className="text-[11px] text-slate-400">Spaced repetition anti-lupa</span>
        </button>

        <button
          onClick={() => weakestSpec && onStartWeakest(weakestSpec.id)}
          className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
            dark ? 'border-slate-800 bg-slate-900 hover:border-rose-500/40' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="rounded-xl bg-rose-500/15 p-2 text-rose-400">
            <Target className="h-5 w-5" />
          </div>
          <span className="mt-2.5 text-sm font-bold">Serang Lemah</span>
          <span className="text-[11px] text-slate-400 truncate w-full">
            Fokus: {weakestSpec?.shortName || 'Bedah'}
          </span>
        </button>
      </section>

      {/* Content Overview Footer */}
      <section
        className={`rounded-2xl border p-3.5 text-xs ${
          dark ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-white text-slate-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <span>
            <strong className={dark ? 'text-slate-200' : 'text-slate-900'}>{manifest.totalQuestions.toLocaleString()}</strong> Bank Soal •{' '}
            <strong className={dark ? 'text-slate-200' : 'text-slate-900'}>{manifest.totalFlashcards}</strong> Flashcard •{' '}
            <strong className={dark ? 'text-slate-200' : 'text-slate-900'}>{manifest.totalVideos}</strong> Video
          </span>
          <button onClick={() => onOpenTab('library')} className="font-bold text-emerald-400">
            Cari Video →
          </button>
        </div>
      </section>
    </div>
  );
}
