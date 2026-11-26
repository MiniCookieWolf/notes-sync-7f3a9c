import { computeSpecialtyStats } from './srs';
import { addDaysISO, daysBetweenISO, todayISO } from './storage';
import type { ScheduledDay, SpecialtyMeta, UserProgress } from './types';

export function buildAdaptiveSchedule(
  specialties: SpecialtyMeta[],
  progress: UserProgress
): ScheduledDay[] {
  const cfg = progress.planConfig;
  const today = todayISO();
  const totalDaysRaw = Math.max(7, daysBetweenISO(today, cfg.examDate));
  const totalDays = Math.min(180, totalDaysRaw);
  const activeSet = new Set(cfg.activeDays.length ? cfg.activeDays : [0, 1, 2, 3, 4, 5, 6]);

  const specStats = computeSpecialtyStats(specialties, progress);
  // Rank specialties by weakness + blueprint weight
  const rankedSpecs = [...specialties].sort((a, b) => {
    const sa = specStats[a.id]?.weakScore || a.weight;
    const sb = specStats[b.id]?.weakScore || b.weight;
    return sb - sa;
  });

  // Collect all active study dates
  const activeDates: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const dISO = addDaysISO(today, i);
    const [y, m, d] = dISO.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    if (activeSet.has(dow)) activeDates.push(dISO);
  }
  if (activeDates.length === 0) activeDates.push(today);

  const n = activeDates.length;
  const fondasiEnd = Math.max(1, Math.floor(n * 0.6));
  const penguatanEnd = Math.max(fondasiEnd + 1, Math.floor(n * 0.85));

  // Questions pace calibrated to daily minutes (~2.2 min per active recall question + rationale)
  const baseQuestions = Math.max(8, Math.round((cfg.dailyMinutes * 0.7) / 2.2));
  const baseSrs = Math.max(4, Math.round(baseQuestions * 0.35));
  const baseFlash = Math.max(5, Math.round((cfg.dailyMinutes * 0.3) / 1.5));

  const offset = progress.scheduleOffsetDays || 0;
  const schedule: ScheduledDay[] = [];

  for (let idx = 0; idx < n; idx++) {
    const dISO = activeDates[idx];
    const shiftedIdx = idx + offset;
    let phase: ScheduledDay['phase'] = 'Fondasi';
    let targetQuestions = baseQuestions;
    let targetSrs = baseSrs;
    let targetFlashcards = baseFlash;
    let daySpecs: string[] = [];
    let focusLabel = '';

    if (idx < fondasiEnd) {
      phase = 'Fondasi';
      const s1 = specialties[shiftedIdx % specialties.length];
      const s2 = specialties[(shiftedIdx + 5) % specialties.length];
      daySpecs = s1.id === s2.id ? [s1.id] : [s1.id, s2.id];
      focusLabel = `Kuasai ${s1.shortName} & ${s2.shortName} + SRS`;
    } else if (idx < penguatanEnd) {
      phase = 'Penguatan';
      const weakPool = rankedSpecs.slice(0, 6);
      const s1 = weakPool[shiftedIdx % weakPool.length];
      const s2 = weakPool[(shiftedIdx + 2) % weakPool.length];
      daySpecs = s1.id === s2.id ? [s1.id] : [s1.id, s2.id];
      targetQuestions = Math.round(baseQuestions * 1.15);
      focusLabel = `Serang Titik Lemah: ${s1.shortName} & ${s2.shortName}`;
    } else {
      phase = 'Simulasi';
      const isMockDay = idx % 3 === 0 || idx === n - 1;
      daySpecs = rankedSpecs.slice(0, 4).map((s) => s.id);
      if (idx === n - 1) {
        targetQuestions = 10;
        targetFlashcards = 10;
        focusLabel = 'Tapering H-1: Review Ringkas & Jaga Tenang';
      } else if (isMockDay) {
        targetQuestions = Math.max(50, baseQuestions * 2);
        targetFlashcards = 5;
        focusLabel = 'Simulasi CBT Campuran 18 Bidang';
      } else {
        targetQuestions = baseQuestions;
        focusLabel = 'Evaluasi Salah TO & Video Timestamp';
      }
    }

    schedule.push({
      date: dISO,
      phase,
      specialties: daySpecs,
      targetQuestions,
      targetSrs,
      targetFlashcards,
      estimatedMinutes: cfg.dailyMinutes,
      focusLabel,
    });
  }

  return schedule;
}

export function generateICSFile(schedule: ScheduledDay[], reminderTime: string): string {
  const [hh, mm] = (reminderTime || '19:30').split(':').map((x) => Number(x) || 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UKMPPD Active Mastery//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const day of schedule.slice(0, 60)) {
    const dtStr = day.date.replace(/-/g, '');
    const startStr = `${dtStr}T${pad(hh)}${pad(mm)}00`;
    const endHour = Math.min(23, hh + Math.max(1, Math.round(day.estimatedMinutes / 60)));
    const endStr = `${dtStr}T${pad(endHour)}${pad(mm)}00`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:ukmppd-${dtStr}@activemastery.local`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:[UKMPPD ${day.phase}] ${day.focusLabel}`,
      `DESCRIPTION:Target hari ini: ${day.targetQuestions} soal latihan + ${day.targetSrs} review SRS + ${day.targetFlashcards} flashcards active recall.`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Waktunya Active Learning UKMPPD: ${day.focusLabel}`,
      'TRIGGER:-PT10M',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
