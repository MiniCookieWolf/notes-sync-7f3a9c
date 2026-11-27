import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ArrowUpCircle, Flame, Lock, Moon, Settings, Sun, WifiOff, X } from 'lucide-react';
import { BottomNav, type TabId } from './components/BottomNav';
import { QuizSession } from './components/QuizSession';
import { loadAllQuestions, loadManifest, loadSpecialtyQuestions } from './lib/dataLoader';
import {
  getDueIds,
  pickSmartMixQuestions,
  shuffleArray,
  updateSRSRecord,
  type SRSRating,
} from './lib/srs';
import { loadProgress, saveProgress, todayISO, defaultProgress } from './lib/storage';
import {
  checkForAppUpdate,
  shouldAutoCheck,
  type UpdateCheckResult,
} from './lib/updater';
import type {
  Flashcard,
  ManifestData,
  QuizSessionConfig,
  StudyPlanConfig,
  UserProgress,
} from './lib/types';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { PlannerPage } from './pages/PlannerPage';
import { QuizHubPage } from './pages/QuizHubPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

const ACCESS_KEY = 'ws_access_ok_v1';

export default function App() {
  const [unlocked, setUnlocked] = useState<boolean>(() => localStorage.getItem(ACCESS_KEY) === '1');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [tabHistory, setTabHistory] = useState<TabId[]>(['home']);
  const [showSettings, setShowSettings] = useState(false);
  const [session, setSession] = useState<QuizSessionConfig | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateCheckResult | null>(null);
  const [exitToast, setExitToast] = useState(false);
  const modalBackHandlerRef = useRef<(() => boolean) | null>(null);
  const lastBackPressRef = useRef(0);

  const registerModalBackHandler = useCallback((fn: (() => boolean) | null) => {
    modalBackHandlerRef.current = fn;
  }, []);

  const navigateTab = useCallback((tab: TabId) => {
    setShowSettings(false);
    setActiveTab((prev) => {
      if (prev !== tab) {
        setTabHistory((hist) => [...hist.slice(-9), tab]);
      }
      return tab;
    });
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Android hardware / gesture Back button navigation
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handlePromise = CapacitorApp.addListener('backButton', () => {
      if (modalBackHandlerRef.current && modalBackHandlerRef.current()) {
        return;
      }
      if (session) {
        setSession(null);
        return;
      }
      if (showSettings) {
        setShowSettings(false);
        return;
      }
      if (tabHistory.length > 1) {
        const nextHist = tabHistory.slice(0, -1);
        setTabHistory(nextHist);
        setActiveTab(nextHist[nextHist.length - 1]);
        return;
      }
      if (activeTab !== 'home') {
        setTabHistory(['home']);
        setActiveTab('home');
        return;
      }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackPressRef.current = now;
        setExitToast(true);
        setTimeout(() => setExitToast(false), 2000);
      }
    });
    return () => {
      handlePromise.then((h) => h.remove()).catch(() => {});
    };
  }, [session, showSettings, tabHistory, activeTab]);

  useEffect(() => {
    if (!unlocked) return;
    loadManifest()
      .then(setManifest)
      .catch((err) => setLoadError(String(err)));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !isOnline || !progress.settings.autoCheckUpdates || !shouldAutoCheck(progress.settings.autoCheckUpdates)) return;
    checkForAppUpdate().then((res) => {
      if (res.status === 'update_available') {
        setAvailableUpdate(res);
      }
    });
  }, [unlocked, isOnline, progress.settings.autoCheckUpdates]);

  useEffect(() => {
    saveProgress(progress);
    document.documentElement.classList.toggle('dark', progress.settings.darkMode);
  }, [progress]);

  // Trigger in-app scheduled notification if enabled & time matches
  useEffect(() => {
    if (!progress.planConfig.notificationsEnabled || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const today = todayISO();
    const answered = progress.dailyLogs[today]?.answered || 0;
    if (answered === 0) {
      const [hh, mm] = progress.planConfig.reminderTime.split(':').map(Number);
      const now = new Date();
      if (now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm)) {
        const key = `notified_${today}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          new Notification('UKMPPD Active Mastery', {
            body: 'Misi belajar hari ini belum disentuh! Yuk 5 soal Active Recall sekarang.',
          });
        }
      }
    }
  }, [progress.planConfig, progress.dailyLogs]);

  const handleRecordAnswer = (
    questionId: string,
    specialty: string,
    isCorrect: boolean,
    rating: SRSRating,
    elapsedSec: number
  ) => {
    const today = todayISO();
    setProgress((prev) => {
      const prevRec = prev.srs[questionId];
      const nextRec = updateSRSRecord(prevRec, questionId, specialty, rating, isCorrect);
      const prevLog = prev.dailyLogs[today] || {
        date: today,
        answered: 0,
        correct: 0,
        flashcards: 0,
        minutes: 0,
        xp: 0,
      };
      const xpGain = isCorrect ? 15 : 6;
      const streak =
        prev.lastStudyDate === today
          ? Math.max(1, prev.streakDays)
          : prev.lastStudyDate
          ? prev.streakDays + 1
          : 1;

      return {
        ...prev,
        xp: prev.xp + xpGain,
        streakDays: streak,
        lastStudyDate: today,
        srs: { ...prev.srs, [questionId]: nextRec },
        dailyLogs: {
          ...prev.dailyLogs,
          [today]: {
            ...prevLog,
            answered: prevLog.answered + 1,
            correct: prevLog.correct + (isCorrect ? 1 : 0),
            minutes: prevLog.minutes + Math.max(1, Math.round(elapsedSec / 60)),
            xp: prevLog.xp + xpGain,
          },
        },
      };
    });
  };

  const handleAdjustSrsRating = (
    questionId: string,
    specialty: string,
    isCorrect: boolean,
    rating: SRSRating
  ) => {
    setProgress((prev) => {
      const prevRec = prev.srs[questionId];
      const nextRec = updateSRSRecord(prevRec, questionId, specialty, rating, isCorrect);
      if (prevRec) {
        // Keep attempt/correct counters from the initial answer event; only adjust SRS schedule
        nextRec.attempts = prevRec.attempts;
        nextRec.correctCount = prevRec.correctCount;
      }
      return {
        ...prev,
        srs: { ...prev.srs, [questionId]: nextRec },
      };
    });
  };

  const handleRateFlashcard = (fc: Flashcard, easy: boolean) => {
    const today = todayISO();
    setProgress((prev) => {
      const nextRec = updateSRSRecord(
        prev.flashcardSrs[fc.id],
        fc.id,
        fc.specialty,
        easy ? 'easy' : 'again',
        easy
      );
      const prevLog = prev.dailyLogs[today] || {
        date: today,
        answered: 0,
        correct: 0,
        flashcards: 0,
        minutes: 0,
        xp: 0,
      };
      return {
        ...prev,
        xp: prev.xp + 8,
        streakDays: prev.lastStudyDate === today ? Math.max(1, prev.streakDays) : prev.streakDays + 1,
        lastStudyDate: today,
        flashcardSrs: { ...prev.flashcardSrs, [fc.id]: nextRec },
        dailyLogs: {
          ...prev.dailyLogs,
          [today]: {
            ...prevLog,
            flashcards: prevLog.flashcards + 1,
            xp: prevLog.xp + 8,
          },
        },
      };
    });
  };

  const launchRandomQuiz = async (opts: {
    count: number;
    filter: 'smart' | 'all' | 'unseen' | 'wrong' | 'bookmarked';
    activeRecall: boolean;
    title?: string;
  }) => {
    if (!manifest) return;
    setLoadingQuiz(true);
    try {
      const allQ = await loadAllQuestions(manifest.specialties.map((s) => s.id));
      let pool = allQ.filter((q) => q.answerVerified);
      if (opts.filter === 'unseen') {
        pool = shuffleArray(pool.filter((q) => !progress.srs[q.id]));
      } else if (opts.filter === 'wrong') {
        pool = shuffleArray(pool.filter((q) => progress.srs[q.id] && !progress.srs[q.id].lastCorrect));
      } else if (opts.filter === 'bookmarked') {
        pool = shuffleArray(allQ.filter((q) => progress.bookmarks.includes(q.id)));
      } else if (opts.filter === 'smart') {
        pool = pickSmartMixQuestions(allQ, progress, manifest.specialties, opts.count, true);
      } else {
        pool = shuffleArray(pool);
      }

      setSession({
        title: opts.title || 'Latihan Random UKMPPD',
        subtitle: `${opts.count} Soal`,
        questions: pool.slice(0, opts.count),
        mode: 'practice',
        activeRecallFirst: opts.activeRecall,
      });
    } finally {
      setLoadingQuiz(false);
    }
  };

  const launchSpecialtyQuiz = async (opts: {
    specialtyId: string;
    count: number;
    categoryFilter: string;
    activeRecall: boolean;
  }) => {
    if (!manifest) return;
    setLoadingQuiz(true);
    try {
      const qs = await loadSpecialtyQuestions(opts.specialtyId);
      let pool = qs;
      if (opts.categoryFilter !== 'all') {
        const filtered = qs.filter((q) => q.sourceCategory === opts.categoryFilter);
        if (filtered.length > 0) pool = filtered;
      }
      if (opts.categoryFilter !== 'jawara' && opts.categoryFilter !== 'ukomnas') {
        const verified = pool.filter((q) => q.answerVerified);
        if (verified.length > 0) pool = verified;
      }
      const picked = pickSmartMixQuestions(pool, progress, manifest.specialties, opts.count, false);
      const specName = manifest.specialties.find((s) => s.id === opts.specialtyId)?.shortName || opts.specialtyId;
      setSession({
        title: `Bidang ${specName}`,
        subtitle: opts.categoryFilter,
        questions: picked,
        mode: 'practice',
        activeRecallFirst: opts.activeRecall,
      });
    } finally {
      setLoadingQuiz(false);
    }
  };

  const launchDueSrsQuiz = async () => {
    if (!manifest) return;
    const dueIds = new Set(getDueIds(progress.srs));
    if (dueIds.size === 0) {
      return launchRandomQuiz({
        count: 10,
        filter: 'smart',
        activeRecall: progress.settings.activeRecallDefault,
        title: 'Smart Mix Anti-Lupa',
      });
    }
    setLoadingQuiz(true);
    try {
      const allQ = await loadAllQuestions(manifest.specialties.map((s) => s.id));
      const dueQs = shuffleArray(allQ.filter((q) => dueIds.has(q.id))).slice(0, 20);
      setSession({
        title: 'Review Spaced Repetition',
        subtitle: `${dueQs.length} soal jatuh tempo`,
        questions: dueQs,
        mode: 'practice',
        activeRecallFirst: progress.settings.activeRecallDefault,
      });
    } finally {
      setLoadingQuiz(false);
    }
  };

  const launchCbt = async (count: number) => {
    if (!manifest) return;
    setLoadingQuiz(true);
    try {
      const allQ = await loadAllQuestions(manifest.specialties.map((s) => s.id));
      const verified = allQ.filter((q) => q.answerVerified);
      // Proportional blueprint sampling
      let picked: typeof verified = [];
      for (const s of manifest.specialties) {
        const quota = Math.max(1, Math.round((s.weight / 100) * count));
        const specPool = shuffleArray(verified.filter((q) => q.specialty === s.id));
        picked.push(...specPool.slice(0, quota));
      }
      picked = shuffleArray(picked).slice(0, count);
      setSession({
        title: `Simulasi CBT (${count} Soal)`,
        subtitle: 'Mode Ujian',
        questions: picked,
        mode: 'cbt',
        activeRecallFirst: false,
        timeLimitSec: count * 60,
      });
    } finally {
      setLoadingQuiz(false);
    }
  };

  const launchMission = async (specs: string[], count: number) => {
    if (!manifest) return;
    setLoadingQuiz(true);
    try {
      const qs = await loadAllQuestions(specs.length ? specs : manifest.specialties.map((s) => s.id));
      const picked = pickSmartMixQuestions(qs, progress, manifest.specialties, count, true);
      setSession({
        title: 'Misi Jadwal Hari Ini',
        subtitle: `${count} soal`,
        questions: picked,
        mode: 'practice',
        activeRecallFirst: progress.settings.activeRecallDefault,
      });
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPin = localStorage.getItem('ws_pin_v1') || '2611';
    if (pinInput.trim() === expectedPin) {
      localStorage.setItem(ACCESS_KEY, '1');
      setPinError(false);
      setUnlocked(true);
    } else {
      setPinError(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <form
          onSubmit={handleUnlockSubmit}
          className="w-full max-w-xs space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight">Workspace Sync</h1>
            <p className="mt-1 text-xs text-slate-400">Masukkan kode akses untuk membuka sesi lokal</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setPinError(false);
            }}
            placeholder="••••"
            autoFocus
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 text-center text-lg font-bold tracking-[0.4em] text-white focus:border-emerald-500 focus:outline-none"
          />
          {pinError && <p className="text-xs font-semibold text-rose-400">Kode tidak sesuai</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white active:scale-[0.98]"
          >
            Buka Sesi
          </button>
        </form>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-200">
        <div>
          <p className="text-base font-bold text-rose-400">Gagal memuat data Bank Soal</p>
          <p className="mt-2 text-xs text-slate-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="text-center space-y-2">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-400">Menyiapkan UKMPPD Active Mastery...</p>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <QuizSession
        config={session}
        specialties={manifest.specialties}
        progress={progress}
        onRecordAnswer={handleRecordAnswer}
        onAdjustSrsRating={handleAdjustSrsRating}
        onToggleBookmark={(id) =>
          setProgress((p) => ({
            ...p,
            bookmarks: p.bookmarks.includes(id)
              ? p.bookmarks.filter((b) => b !== id)
              : [...p.bookmarks, id],
          }))
        }
        onSaveNote={(id, note) =>
          setProgress((p) => ({
            ...p,
            notes: { ...p.notes, [id]: note },
          }))
        }
        registerBackHandler={registerModalBackHandler}
        onExit={() => setSession(null)}
      />
    );
  }

  const dark = progress.settings.darkMode;
  const dueCount = getDueIds(progress.srs).length;

  return (
    <div
      className={`min-h-screen pb-24 ${
        dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top App Bar */}
      <header
        className={`sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-lg ${
          dark ? 'border-slate-800 bg-slate-950/90' : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <h1 className="text-base font-black tracking-tight">
              UKMPPD <span className="text-emerald-400">Active Mastery</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-extrabold text-orange-400">
              <Flame className="h-3.5 w-3.5" /> {progress.streakDays}
            </span>
            <button
              onClick={() =>
                setProgress((p) => ({
                  ...p,
                  settings: { ...p.settings, darkMode: !p.settings.darkMode },
                }))
              }
              className={`rounded-xl p-1.5 ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
              title="Ganti Tema"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`rounded-xl p-1.5 ${
                showSettings
                  ? 'bg-emerald-600 text-white'
                  : dark
                  ? 'bg-slate-800 text-slate-300'
                  : 'bg-slate-200 text-slate-700'
              }`}
              title="Pengaturan"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 pt-4">
        {availableUpdate && availableUpdate.status === 'update_available' && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="font-bold text-emerald-200 truncate">
                Update APK v{availableUpdate.latestVersion} tersedia!
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={availableUpdate.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-600 px-2.5 py-1 font-extrabold text-white"
              >
                Update
              </a>
              <button
                onClick={() => setAvailableUpdate(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
                aria-label="Tutup banner update"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {loadingQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-2xl bg-slate-900 px-6 py-4 text-center border border-slate-800">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
              <p className="mt-2 text-xs font-bold text-slate-200">Meracik soal Active Recall...</p>
            </div>
          </div>
        )}

        {showSettings ? (
          <SettingsPage
            manifest={manifest}
            progress={progress}
            onUpdateSettings={(patch) =>
              setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }))
            }
            onImportProgress={(next) => setProgress(next)}
            onResetProgress={() => {
              const fresh = defaultProgress();
              setProgress(fresh);
            }}
            onLockNow={() => {
              localStorage.removeItem(ACCESS_KEY);
              setPinInput('');
              setShowSettings(false);
              setUnlocked(false);
            }}
            registerBackHandler={registerModalBackHandler}
            onBack={() => setShowSettings(false)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomePage
                manifest={manifest}
                progress={progress}
                onStartQuick5={() =>
                  launchRandomQuiz({
                    count: 5,
                    filter: 'smart',
                    activeRecall: progress.settings.activeRecallDefault,
                    title: '5 Menit Aja! (Kilat)',
                  })
                }
                onStartRandom={(count) =>
                  launchRandomQuiz({
                    count,
                    filter: 'smart',
                    activeRecall: progress.settings.activeRecallDefault,
                  })
                }
                onStartDueSrs={launchDueSrsQuiz}
                onStartWeakest={(specId) =>
                  launchSpecialtyQuiz({
                    specialtyId: specId,
                    count: 15,
                    categoryFilter: 'all',
                    activeRecall: progress.settings.activeRecallDefault,
                  })
                }
                onStartTodayMission={launchMission}
                onOpenTab={(t) => navigateTab(t)}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizHubPage
                manifest={manifest}
                progress={progress}
                onToggleActiveRecall={(nextVal) =>
                  setProgress((p) => ({
                    ...p,
                    settings: { ...p.settings, activeRecallDefault: nextVal },
                  }))
                }
                onStartRandom={launchRandomQuiz}
                onStartSpecialty={launchSpecialtyQuiz}
                onStartCbt={launchCbt}
              />
            )}

            {activeTab === 'planner' && (
              <PlannerPage
                manifest={manifest}
                progress={progress}
                onUpdatePlan={(cfg: StudyPlanConfig) =>
                  setProgress((p) => ({ ...p, planConfig: cfg }))
                }
                onRebalance={() =>
                  setProgress((p) => ({ ...p, scheduleOffsetDays: (p.scheduleOffsetDays || 0) + 1 }))
                }
                onStartDayMission={launchMission}
              />
            )}

            {activeTab === 'library' && (
              <LibraryPage
                manifest={manifest}
                progress={progress}
                onRateFlashcard={handleRateFlashcard}
              />
            )}

            {activeTab === 'stats' && (
              <StatsPage
                manifest={manifest}
                progress={progress}
                onOpenSettings={() => setShowSettings(true)}
                onStartSpecialtyWeak={(specId) =>
                  launchSpecialtyQuiz({
                    specialtyId: specId,
                    count: 15,
                    categoryFilter: 'all',
                    activeRecall: progress.settings.activeRecallDefault,
                  })
                }
              />
            )}
          </>
        )}
      </main>

      {exitToast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-xl border border-slate-700">
          Tekan kembali sekali lagi untuk keluar
        </div>
      )}

      <BottomNav
        activeTab={activeTab}
        onSelect={navigateTab}
        dueCount={dueCount}
        darkMode={dark}
      />
    </div>
  );
}
