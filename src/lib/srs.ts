import { addDaysISO, todayISO } from './storage';
import type { Question, SRSRecord, SpecialtyMeta, UserProgress } from './types';

export type SRSRating = 'again' | 'hard' | 'good' | 'easy';

export function updateSRSRecord(
  prev: SRSRecord | undefined,
  id: string,
  specialty: string,
  rating: SRSRating,
  isCorrect: boolean
): SRSRecord {
  const today = todayISO();
  const base: SRSRecord = prev || {
    id,
    specialty,
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueDate: today,
    lastReviewed: today,
    lastCorrect: isCorrect,
    attempts: 0,
    correctCount: 0,
  };

  let ease = base.ease;
  let interval = base.intervalDays;
  let reps = base.reps;
  let lapses = base.lapses;

  if (rating === 'again') {
    reps = 0;
    lapses += 1;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === 'hard') {
    reps += 1;
    interval = interval <= 1 ? 2 : Math.round(interval * 1.35);
    ease = Math.max(1.3, ease - 0.12);
  } else if (rating === 'good') {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 4;
    else interval = Math.round(interval * ease);
  } else {
    // easy
    reps += 1;
    ease = Math.min(3.0, ease + 0.15);
    if (reps === 1) interval = 4;
    else interval = Math.round(Math.max(4, interval) * ease * 1.25);
  }

  return {
    id,
    specialty,
    ease: Number(ease.toFixed(2)),
    intervalDays: interval,
    reps,
    lapses,
    dueDate: addDaysISO(today, interval),
    lastReviewed: today,
    lastCorrect: isCorrect,
    attempts: base.attempts + 1,
    correctCount: base.correctCount + (isCorrect ? 1 : 0),
  };
}

export function getDueIds(srsMap: Record<string, SRSRecord>): string[] {
  const today = todayISO();
  return Object.values(srsMap)
    .filter((r) => r.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((r) => r.id);
}

export interface SpecialtyStat {
  id: string;
  attempted: number;
  correct: number;
  accuracy: number;
  uniqueSolved: number;
  coveragePct: number;
  dueCount: number;
  weakScore: number; // higher = needs more attention
}

export function computeSpecialtyStats(
  specialties: SpecialtyMeta[],
  progress: UserProgress
): Record<string, SpecialtyStat> {
  const today = todayISO();
  const out: Record<string, SpecialtyStat> = {};
  for (const s of specialties) {
    out[s.id] = {
      id: s.id,
      attempted: 0,
      correct: 0,
      accuracy: 0,
      uniqueSolved: 0,
      coveragePct: 0,
      dueCount: 0,
      weakScore: s.weight * 1.5, // prioritize high-weight specialties when unseen
    };
  }

  for (const rec of Object.values(progress.srs)) {
    const st = out[rec.specialty];
    if (!st) continue;
    st.uniqueSolved += 1;
    st.attempted += rec.attempts;
    st.correct += rec.correctCount;
    if (rec.dueDate <= today) st.dueCount += 1;
  }

  for (const s of specialties) {
    const st = out[s.id];
    st.coveragePct = s.questionCount > 0 ? Math.min(100, Math.round((st.uniqueSolved / s.questionCount) * 100)) : 0;
    if (st.attempted > 0) {
      st.accuracy = Math.round((st.correct / st.attempted) * 100);
      // Higher weakScore for low accuracy, high exam weight, and due items
      const gap = Math.max(0, 80 - st.accuracy);
      st.weakScore = gap * 1.2 + s.weight + st.dueCount * 2;
    }
  }
  return out;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickSmartMixQuestions(
  allQuestions: Question[],
  progress: UserProgress,
  specialties: SpecialtyMeta[],
  count: number,
  verifiedOnly = true
): Question[] {
  const pool = verifiedOnly ? allQuestions.filter((q) => q.answerVerified) : allQuestions;
  const today = todayISO();
  const specStats = computeSpecialtyStats(specialties, progress);

  const dueList: Question[] = [];
  const wrongList: Question[] = [];
  const unseenList: Question[] = [];
  const restList: Question[] = [];

  for (const q of pool) {
    const rec = progress.srs[q.id];
    if (!rec) {
      unseenList.push(q);
    } else if (rec.dueDate <= today) {
      dueList.push(q);
    } else if (!rec.lastCorrect) {
      wrongList.push(q);
    } else {
      restList.push(q);
    }
  }

  // Sort unseen by weakest/highest-weight specialty first (with randomness)
  const unseenWeighted = shuffleArray(unseenList).sort((a, b) => {
    const wa = specStats[a.specialty]?.weakScore || 0;
    const wb = specStats[b.specialty]?.weakScore || 0;
    return wb - wa + (Math.random() * 12 - 6);
  });

  const ordered = [
    ...shuffleArray(dueList),
    ...shuffleArray(wrongList),
    ...unseenWeighted,
    ...shuffleArray(restList),
  ];

  return ordered.slice(0, count);
}
