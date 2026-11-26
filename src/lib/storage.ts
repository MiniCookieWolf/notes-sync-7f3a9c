import type { StudyPlanConfig, UserProgress } from './types';

const STORAGE_KEY = 'ukmppd_active_mastery_v1';

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysISO(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function daysBetweenISO(startISO: string, endISO: string): number {
  const [y1, m1, d1] = startISO.split('-').map(Number);
  const [y2, m2, d2] = endISO.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export function defaultPlanConfig(): StudyPlanConfig {
  return {
    examDate: addDaysISO(todayISO(), 60),
    dailyMinutes: 60,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    targetAccuracy: 75,
    reminderTime: '19:30',
    notificationsEnabled: false,
  };
}

export function defaultProgress(): UserProgress {
  return {
    xp: 0,
    streakDays: 0,
    lastStudyDate: '',
    bestCombo: 0,
    srs: {},
    flashcardSrs: {},
    bookmarks: [],
    notes: {},
    dailyLogs: {},
    planConfig: defaultPlanConfig(),
    scheduleOffsetDays: 0,
    settings: {
      darkMode: true,
      haptics: true,
      activeRecallDefault: true,
      showKeywordsHint: false,
      fontSize: 'normal',
      userName: 'Dokter Pejuang',
    },
  };
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<UserProgress>;
    const def = defaultProgress();
    const merged: UserProgress = {
      ...def,
      ...parsed,
      planConfig: { ...def.planConfig, ...(parsed.planConfig || {}) },
      settings: { ...def.settings, ...(parsed.settings || {}) },
      srs: parsed.srs || {},
      flashcardSrs: parsed.flashcardSrs || {},
      bookmarks: parsed.bookmarks || [],
      notes: parsed.notes || {},
      dailyLogs: parsed.dailyLogs || {},
    };
    // Recalculate streak continuity if missed > 1 day
    if (merged.lastStudyDate) {
      const gap = daysBetweenISO(merged.lastStudyDate, todayISO());
      if (gap > 1) {
        merged.streakDays = 0;
      }
    }
    return merged;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function exportProgressJSON(progress: UserProgress): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), data: progress }, null, 2);
}

export function importProgressJSON(raw: string): UserProgress | null {
  try {
    const parsed = JSON.parse(raw);
    const candidate = parsed.data || parsed;
    if (!candidate || typeof candidate !== 'object' || !candidate.srs) return null;
    const def = defaultProgress();
    return {
      ...def,
      ...candidate,
      planConfig: { ...def.planConfig, ...(candidate.planConfig || {}) },
      settings: { ...def.settings, ...(candidate.settings || {}) },
    };
  } catch {
    return null;
  }
}
