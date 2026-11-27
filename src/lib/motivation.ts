import { daysBetweenISO, todayISO } from './storage';
import type { SpecialtyMeta, UserProgress } from './types';

export interface RankInfo {
  title: string;
  level: number;
  minXp: number;
  nextXp: number;
}

const RANKS: Array<{ title: string; minXp: number }> = [
  { title: 'Koas Pemula', minXp: 0 },
  { title: 'Residen Muda', minXp: 150 },
  { title: 'Pejuang Kognitif', minXp: 450 },
  { title: 'Dokter Muda Tangguh', minXp: 1000 },
  { title: 'Master Vignette', minXp: 2000 },
  { title: 'Bintang Try Out', minXp: 3500 },
  { title: 'Calon Dokter Kompeten', minXp: 6000 },
  { title: 'Dokter One-Shot UKMPPD', minXp: 10000 },
];

export function getRankInfo(xp: number): RankInfo {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) idx = i;
  }
  const current = RANKS[idx];
  const next = RANKS[Math.min(RANKS.length - 1, idx + 1)];
  return {
    title: current.title,
    level: idx + 1,
    minXp: current.minXp,
    nextXp: next.minXp === current.minXp ? current.minXp + 5000 : next.minXp,
  };
}

export function triggerHaptic(enabled: boolean, pattern: number | number[] = 15): void {
  if (!enabled) return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore on unsupported devices
  }
}

export function getMotivationalPush(
  progress: UserProgress,
  weakestSpecName: string,
  dueCount: number
): { headline: string; body: string; cta: string } {
  const hour = new Date().getHours();
  const daysLeft = Math.max(0, daysBetweenISO(todayISO(), progress.planConfig.examDate));
  const todayLog = progress.dailyLogs[todayISO()];
  const answeredToday = todayLog?.answered || 0;

  if (answeredToday === 0) {
    if (hour < 11) {
      return {
        headline: `Selamat Pagi, ${progress.settings.userName}!`,
        body: `Otak masih segar — cukup 5 soal Active Recall sekarang untuk nyalakan momentum${progress.streakDays > 0 ? ` & jaga streak ${progress.streakDays} hari` : ''}.`,
        cta: 'Mulai 5 Soal Kilat',
      };
    }
    if (hour < 18) {
      return {
        headline: `H-${daysLeft} Menuju UKMPPD — Jangan Kasih Kendor!`,
        body: dueCount > 0
          ? `Ada ${dueCount} soal Spaced Repetition yang siap diulang sebelum lupa. 5 menit aja sudah menyelamatkan retensi memori!`
          : `Bidang ${weakestSpecName} menunggu untuk ditaklukkan. Satu sesi singkat hari ini = 1 langkah lebih dekat ke One-Shot!`,
        cta: dueCount > 0 ? `Ulangi ${Math.min(10, dueCount)} SRS` : 'Latihan Sekarang',
      };
    }
    return {
      headline: `Malam Produktif Sebelum Tidur!`,
      body: `Riset membuktikan belajar 10 menit sebelum tidur memperkuat konsolidasi memori jangka panjang. Gas 5 soal dulu sebelum istirahat!`,
      cta: 'Sikat 5 Soal Malam',
    };
  }

  if (answeredToday < 15) {
    return {
      headline: `Mantap! ${answeredToday} Soal Sudah Tuntas Hari Ini 🔥`,
      body: `Momentum sudah nyala! Tambah 10 soal lagi di bidang ${weakestSpecName} biar akurasi makin aman di atas 75%.`,
      cta: 'Lanjut Gas Lagi',
    };
  }

  return {
    headline: `Luar Biasa! ${answeredToday} Soal Hari Ini 🏆`,
    body: `Konsistensi seperti ini yang bikin lulus UKMPPD sekali tembak (One-Shot). Jangan lupa cek timestamp video untuk soal yang masih ragu!`,
    cta: 'Review Soal Lemah',
  };
}

export const MIN_QUESTIONS_PER_SPECIALTY = 10;

export function computeOverallReadiness(
  progress: UserProgress,
  specialties: SpecialtyMeta[]
): {
  weightedAccuracy: number;
  attemptedTotal: number;
  coveragePct: number;
  readySpecialtiesCount: number;
  totalSpecialties: number;
  minPerSpecialty: number;
  isReadinessReady: boolean;
} {
  const srsValues = Object.values(progress.srs);
  const totalSpecialties = specialties.length;
  if (srsValues.length === 0) {
    return {
      weightedAccuracy: 0,
      attemptedTotal: 0,
      coveragePct: 0,
      readySpecialtiesCount: 0,
      totalSpecialties,
      minPerSpecialty: MIN_QUESTIONS_PER_SPECIALTY,
      isReadinessReady: false,
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  let readySpecialtiesCount = 0;
  const totalQuestionsAll = specialties.reduce((acc, s) => acc + s.verifiedCount, 0);

  for (const s of specialties) {
    const items = srsValues.filter((r) => r.specialty === s.id);
    if (items.length >= MIN_QUESTIONS_PER_SPECIALTY) {
      readySpecialtiesCount += 1;
    }
    if (items.length === 0) continue;
    const att = items.reduce((a, b) => a + b.attempts, 0);
    const cor = items.reduce((a, b) => a + b.correctCount, 0);
    const acc = att > 0 ? (cor / att) * 100 : 0;
    weightedSum += acc * s.weight;
    totalWeight += s.weight;
  }

  const isReadinessReady = totalSpecialties > 0 && readySpecialtiesCount === totalSpecialties;
  const weightedAccuracy =
    isReadinessReady && totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const coveragePct =
    totalQuestionsAll > 0
      ? Math.min(100, Math.round((srsValues.length / totalQuestionsAll) * 100))
      : 0;
  return {
    weightedAccuracy,
    attemptedTotal: srsValues.length,
    coveragePct,
    readySpecialtiesCount,
    totalSpecialties,
    minPerSpecialty: MIN_QUESTIONS_PER_SPECIALTY,
    isReadinessReady,
  };
}
