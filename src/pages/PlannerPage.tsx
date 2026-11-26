import { useMemo, useState } from 'react';
import { Bell, Calendar, Download, Play, RefreshCw } from 'lucide-react';
import { buildAdaptiveSchedule, generateICSFile } from '../lib/scheduler';
import { daysBetweenISO, todayISO } from '../lib/storage';
import type { ManifestData, StudyPlanConfig, UserProgress } from '../lib/types';

interface PlannerPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onUpdatePlan: (cfg: StudyPlanConfig) => void;
  onRebalance: () => void;
  onStartDayMission: (specialties: string[], count: number) => void;
}

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function PlannerPage({
  manifest,
  progress,
  onUpdatePlan,
  onRebalance,
  onStartDayMission,
}: PlannerPageProps) {
  const dark = progress.settings.darkMode;
  const cfg = progress.planConfig;
  const [notifStatus, setNotifStatus] = useState<string>('');
  const specMap = useMemo(
    () => Object.fromEntries(manifest.specialties.map((s) => [s.id, s])),
    [manifest.specialties]
  );

  const schedule = useMemo(
    () => buildAdaptiveSchedule(manifest.specialties, progress),
    [manifest.specialties, progress]
  );

  const daysLeft = Math.max(0, daysBetweenISO(todayISO(), cfg.examDate));

  const toggleDay = (dow: number) => {
    const next = cfg.activeDays.includes(dow)
      ? cfg.activeDays.filter((d) => d !== dow)
      : [...cfg.activeDays, dow].sort();
    if (next.length === 0) return;
    onUpdatePlan({ ...cfg, activeDays: next });
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      setNotifStatus('Browser ini tidak mendukung Web Notification. Gunakan Export .ICS ke Google Calendar!');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      onUpdatePlan({ ...cfg, notificationsEnabled: true });
      setNotifStatus(`Pengingat aktif! Akan mengingatkan tiap ${cfg.reminderTime} saat aplikasi dibuka.`);
      new Notification('UKMPPD Active Mastery', {
        body: `Jadwal harianmu siap! Target hari ini menunggumu 🔥`,
      });
    } else {
      setNotifStatus('Izin notifikasi ditolak. Gunakan tombol Export Google Calendar (.ics) di bawah!');
    }
  };

  const handleDownloadICS = () => {
    const ics = generateICSFile(schedule, cfg.reminderTime);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Jadwal-UKMPPD-${cfg.examDate}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const phaseCounts = useMemo(() => {
    const c = { Fondasi: 0, Penguatan: 0, Simulasi: 0 };
    schedule.forEach((d) => {
      c[d.phase] += 1;
    });
    return c;
  }, [schedule]);

  return (
    <div className="space-y-4 pb-6">
      {/* Target Configuration Card */}
      <section
        className={`space-y-4 rounded-2xl border p-4 ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold">Jadwal Target UKMPPD</h2>
            <p className="text-xs text-slate-400">
              {daysLeft} hari menuju ujian • {schedule.length} sesi belajar terjadwal
            </p>
          </div>
          <button
            onClick={onRebalance}
            className="inline-flex items-center gap-1 rounded-xl bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-400"
            title="Atur ulang jadwal kalau sempat bolos"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reschedule
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400">Tanggal Target Ujian</label>
            <input
              type="date"
              value={cfg.examDate}
              onChange={(e) => onUpdatePlan({ ...cfg, examDate: e.target.value })}
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-bold ${
                dark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
              }`}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400">Jam Pengingat</label>
            <input
              type="time"
              value={cfg.reminderTime}
              onChange={(e) => onUpdatePlan({ ...cfg, reminderTime: e.target.value })}
              className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs font-bold ${
                dark ? 'border-slate-700 bg-slate-950 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
              }`}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-400">Durasi Belajar Harian</span>
            <span className="font-extrabold text-emerald-400">{cfg.dailyMinutes} menit/hari</span>
          </div>
          <input
            type="range"
            min={20}
            max={180}
            step={10}
            value={cfg.dailyMinutes}
            onChange={(e) => onUpdatePlan({ ...cfg, dailyMinutes: Number(e.target.value) })}
            className="mt-1.5 w-full accent-emerald-500"
          />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-slate-400">Hari Aktif Belajar</p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_LABELS.map((lbl, dow) => {
              const active = cfg.activeDays.includes(dow);
              return (
                <button
                  key={dow}
                  onClick={() => toggleDay(dow)}
                  className={`rounded-xl py-2 text-xs font-bold ${
                    active ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 text-slate-500'
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Phase Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-semibold text-slate-400">Peta 3 Fase Menuju One-Shot:</p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div className="bg-emerald-500" style={{ width: '60%' }} title="Fondasi" />
            <div className="bg-cyan-500" style={{ width: '25%' }} title="Penguatan" />
            <div className="bg-amber-500" style={{ width: '15%' }} title="Simulasi" />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>🟢 Fondasi ({phaseCounts.Fondasi} hr)</span>
            <span>🔵 Penguatan ({phaseCounts.Penguatan} hr)</span>
            <span>🟠 Simulasi ({phaseCounts.Simulasi} hr)</span>
          </div>
        </div>

        {/* Alarm / Calendar Export Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleEnableNotifications}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-300"
          >
            <Bell className="h-4 w-4" /> Notifikasi HP
          </button>
          <button
            onClick={handleDownloadICS}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow"
          >
            <Download className="h-4 w-4" /> Alarm Kalender (.ics)
          </button>
        </div>
        {notifStatus && <p className="text-[11px] text-amber-300">{notifStatus}</p>}
      </section>

      {/* Upcoming 14-Day Schedule Agenda */}
      <section className="space-y-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Agenda 14 Hari Mendatang
        </h3>
        {schedule.slice(0, 14).map((day) => {
          const isToday = day.date === todayISO();
          const log = progress.dailyLogs[day.date];
          const done = log && log.answered >= day.targetQuestions;
          return (
            <div
              key={day.date}
              className={`flex items-center justify-between rounded-2xl border p-3.5 ${
                isToday
                  ? 'border-emerald-500/60 bg-emerald-500/10'
                  : dark
                  ? 'border-slate-800 bg-slate-900'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold">{isToday ? 'HARI INI' : day.date}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      day.phase === 'Fondasi'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : day.phase === 'Penguatan'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {day.phase}
                  </span>
                  {done && <span className="text-[10px] font-bold text-emerald-400">✓ Selesai</span>}
                </div>
                <p className="mt-1 text-xs font-bold truncate">{day.focusLabel}</p>
                <p className="text-[11px] text-slate-400">
                  {day.targetQuestions} soal • {day.targetSrs} SRS •{' '}
                  {day.specialties.map((s) => specMap[s]?.shortName || s).join(', ')}
                </p>
              </div>
              <button
                onClick={() => onStartDayMission(day.specialties, day.targetQuestions)}
                className="ml-2 rounded-xl bg-emerald-600/20 p-2.5 text-emerald-400 hover:bg-emerald-600 hover:text-white"
              >
                <Play className="h-4 w-4" fill="currentColor" />
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
