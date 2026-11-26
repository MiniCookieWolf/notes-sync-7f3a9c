import { useState } from 'react';
import { Clock, Play, Shuffle, Sparkles, Stethoscope, Trophy } from 'lucide-react';
import { computeSpecialtyStats } from '../lib/srs';
import type { ManifestData, UserProgress } from '../lib/types';

interface QuizHubPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onStartRandom: (opts: {
    count: number;
    filter: 'smart' | 'all' | 'unseen' | 'wrong' | 'bookmarked';
    activeRecall: boolean;
  }) => void;
  onStartSpecialty: (opts: {
    specialtyId: string;
    count: number;
    categoryFilter: string;
    activeRecall: boolean;
  }) => void;
  onStartCbt: (count: number) => void;
}

const SOURCE_FILTERS = [
  { id: 'all', label: 'Semua Sumber' },
  { id: 'post_test', label: 'Post Test' },
  { id: 'pre_test', label: 'Pre Test' },
  { id: 'soal_pendalaman', label: 'Soal Pendalaman' },
  { id: 'drilling', label: 'Drilling Soal' },
  { id: 'to_akbar', label: 'TO Akbar' },
  { id: 'baper', label: 'Kelon Baper' },
  { id: 'prediksi', label: 'Kelon Prediksi' },
  { id: 'jawara', label: 'Review Jawara' },
];

export function QuizHubPage({
  manifest,
  progress,
  onStartRandom,
  onStartSpecialty,
  onStartCbt,
}: QuizHubPageProps) {
  const [subTab, setSubTab] = useState<'specialty' | 'random' | 'cbt'>('specialty');
  const [randomCount, setRandomCount] = useState(20);
  const [randomFilter, setRandomFilter] = useState<'smart' | 'all' | 'unseen' | 'wrong' | 'bookmarked'>('smart');
  const [specCount, setSpecCount] = useState(15);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeRecall, setActiveRecall] = useState(progress.settings.activeRecallDefault);

  const dark = progress.settings.darkMode;
  const specStats = computeSpecialtyStats(manifest.specialties, progress);

  return (
    <div className="space-y-4 pb-6">
      {/* Mode Selector Pills */}
      <div className={`grid grid-cols-3 gap-1.5 rounded-2xl p-1 ${dark ? 'bg-slate-900' : 'bg-slate-200'}`}>
        <button
          onClick={() => setSubTab('specialty')}
          className={`rounded-xl py-2 text-xs font-bold transition ${
            subTab === 'specialty' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'
          }`}
        >
          Per Bidang (18)
        </button>
        <button
          onClick={() => setSubTab('random')}
          className={`rounded-xl py-2 text-xs font-bold transition ${
            subTab === 'random' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
          }`}
        >
          Random Acak
        </button>
        <button
          onClick={() => setSubTab('cbt')}
          className={`rounded-xl py-2 text-xs font-bold transition ${
            subTab === 'cbt' ? 'bg-amber-600 text-white shadow' : 'text-slate-400'
          }`}
        >
          Simulasi CBT
        </button>
      </div>

      {/* Active Recall Global Toggle */}
      <div
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
          dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-xs font-bold">Active Recall First</p>
            <p className="text-[11px] text-slate-400">Sembunyikan opsi A–E sebelum menebak diagnosis</p>
          </div>
        </div>
        <button
          onClick={() => setActiveRecall((v) => !v)}
          className={`h-6 w-11 rounded-full transition-colors p-0.5 ${
            activeRecall ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full bg-white transition-transform ${
              activeRecall ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Sub-tab 1: 18 Specialties */}
      {subTab === 'specialty' && (
        <div className="space-y-3">
          {/* Controls: Question count & Source filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-slate-900/70 p-1">
              {[10, 15, 30, 50].map((c) => (
                <button
                  key={c}
                  onClick={() => setSpecCount(c)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    specCount === c ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  {c} Soal
                </button>
              ))}
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`flex-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                dark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              {SOURCE_FILTERS.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {manifest.specialties.map((s) => {
              const st = specStats[s.id];
              return (
                <div
                  key={s.id}
                  onClick={() =>
                    onStartSpecialty({
                      specialtyId: s.id,
                      count: specCount,
                      categoryFilter,
                      activeRecall,
                    })
                  }
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition active:scale-[0.99] ${
                    dark ? 'border-slate-800 bg-slate-900 hover:border-slate-700' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold truncate">{s.name}</h4>
                        {st && st.dueCount > 0 && (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                            {st.dueCount} SRS
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {s.questionCount} soal ({s.timestampedCount} ber-timestamp) • Bobot {s.weight}%
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${st?.accuracy || 0}%`,
                              backgroundColor: s.color,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {st?.attempted ? `${st.accuracy}%` : 'Belum'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
                    <Play className="h-4 w-4" fill="currentColor" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab 2: Random Anytime */}
      {subTab === 'random' && (
        <div
          className={`space-y-4 rounded-2xl border p-4 ${
            dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-cyan-500/15 p-2.5 text-cyan-400">
              <Shuffle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Latihan Random Tiap Saat</h3>
              <p className="text-xs text-slate-400">Campuran acak lintas 18 bidang UKMPPD</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-400">Jumlah Soal</p>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((c) => (
                <button
                  key={c}
                  onClick={() => setRandomCount(c)}
                  className={`rounded-xl py-2.5 text-xs font-extrabold border ${
                    randomCount === c
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400'
                  }`}
                >
                  {c} Soal
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-400">Strategi Pemilihan Soal</p>
            <div className="space-y-2">
              {[
                { id: 'smart', title: 'Smart Mix Adaptif (Rekomendasi)', desc: 'Prioritas SRS jatuh tempo + bidang terlemah + soal baru' },
                { id: 'all', title: 'Acak Total Semua Bank Soal', desc: 'Acak murni seluruh soal terverifikasi' },
                { id: 'unseen', title: 'Hanya Soal Belum Pernah Dikerjakan', desc: 'Eksplorasi kasus klinis baru' },
                { id: 'wrong', title: 'Soal yang Pernah Salah', desc: 'Perbaiki kesalahan & perkuat pemahaman' },
                { id: 'bookmarked', title: `Soal Tersimpan / Bookmark (${progress.bookmarks.length})`, desc: 'Review koleksi soal favoritmu' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setRandomFilter(opt.id as typeof randomFilter)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    randomFilter === opt.id
                      ? 'border-cyan-500 bg-cyan-500/15'
                      : 'border-slate-800 bg-slate-950/40'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.title}</p>
                  <p className="text-[11px] text-slate-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onStartRandom({ count: randomCount, filter: randomFilter, activeRecall })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-cyan-600/25 active:scale-[0.98]"
          >
            <Shuffle className="h-4 w-4" /> Mulai Latihan Random ({randomCount} Soal)
          </button>
        </div>
      )}

      {/* Sub-tab 3: CBT Simulation */}
      {subTab === 'cbt' && (
        <div
          className={`space-y-4 rounded-2xl border p-4 ${
            dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Simulasi CBT UKMPPD</h3>
              <p className="text-xs text-slate-400">Timer 1 menit/soal + bobot resmi 18 bidang + evaluasi lulus ≥66%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { count: 50, mins: 50, label: 'Mini TO 50 Soal' },
              { count: 100, mins: 100, label: 'Mid TO 100 Soal' },
              { count: 150, mins: 150, label: 'Full Try Out 150 Soal' },
              { count: 200, mins: 200, label: 'Marathon 200 Soal' },
            ].map((item) => (
              <button
                key={item.count}
                onClick={() => onStartCbt(item.count)}
                className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                  dark ? 'border-slate-800 bg-slate-950/60 hover:border-amber-500/40' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <Clock className="h-3.5 w-3.5" /> {item.mins} Menit
                </span>
                <span className="mt-1.5 text-sm font-extrabold">{item.label}</span>
                <span className="text-[11px] text-slate-400">Pembahasan keluar di akhir</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
