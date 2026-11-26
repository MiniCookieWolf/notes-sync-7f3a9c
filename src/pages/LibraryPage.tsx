import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  FlipHorizontal,
  PlayCircle,
  Search,
  Shuffle,
  Video,
} from 'lucide-react';
import { loadAllFlashcards, loadSpecialtyFlashcards, loadVideosIndex } from '../lib/dataLoader';
import { shuffleArray } from '../lib/srs';
import type { Flashcard, ManifestData, UserProgress, VideosIndexData } from '../lib/types';

interface LibraryPageProps {
  manifest: ManifestData;
  progress: UserProgress;
  onRateFlashcard: (fc: Flashcard, easy: boolean) => void;
}

export function LibraryPage({ manifest, progress, onRateFlashcard }: LibraryPageProps) {
  const [tab, setTab] = useState<'videos' | 'flashcards'>('videos');
  const [videosData, setVideosData] = useState<VideosIndexData | null>(null);
  const [query, setQuery] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('all');
  const [selectedSpec, setSelectedSpec] = useState('all');

  // Flashcards state
  const [fcSpec, setFcSpec] = useState<string>('all');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [fcIdx, setFcIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const dark = progress.settings.darkMode;

  useEffect(() => {
    loadVideosIndex().then(setVideosData).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'flashcards') return;
    if (fcSpec === 'all') {
      loadAllFlashcards(manifest.specialties.map((s) => s.id)).then((all) => {
        setCards(shuffleArray(all));
        setFcIdx(0);
        setFlipped(false);
      });
    } else {
      loadSpecialtyFlashcards(fcSpec).then((list) => {
        setCards(shuffleArray(list));
        setFcIdx(0);
        setFlipped(false);
      });
    }
  }, [tab, fcSpec, manifest.specialties]);

  const filteredVideos = useMemo(() => {
    if (!videosData) return [];
    const q = query.trim().toLowerCase();
    return videosData.videos.filter((v) => {
      if (selectedPlaylist !== 'all' && v.playlistKey !== selectedPlaylist) return false;
      if (selectedSpec !== 'all' && !v.specialties.includes(selectedSpec) && !v.specialties.includes('all')) {
        return false;
      }
      if (!q) return true;
      if (v.title.toLowerCase().includes(q) || v.playlistTitle.toLowerCase().includes(q)) return true;
      return v.chapters.some(
        (c) => c.keywords.toLowerCase().includes(q) || c.snippet.toLowerCase().includes(q)
      );
    });
  }, [videosData, query, selectedPlaylist, selectedSpec]);

  const currentCard = cards[fcIdx];

  return (
    <div className="space-y-4 pb-6">
      <div className={`grid grid-cols-2 gap-1.5 rounded-2xl p-1 ${dark ? 'bg-slate-900' : 'bg-slate-200'}`}>
        <button
          onClick={() => setTab('videos')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold ${
            tab === 'videos' ? 'bg-rose-600 text-white shadow' : 'text-slate-400'
          }`}
        >
          <Video className="h-3.5 w-3.5" /> 138 Video & Timestamp
        </button>
        <button
          onClick={() => setTab('flashcards')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold ${
            tab === 'flashcards' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Flashcard Recall ({manifest.totalFlashcards})
        </button>
      </div>

      {tab === 'videos' && (
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari penyakit/topik (misal: stemi, eklampsia, tb, glaucoma)..."
              className={`w-full rounded-2xl border py-2.5 pl-10 pr-4 text-xs font-medium focus:border-rose-500 focus:outline-none ${
                dark ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedPlaylist}
              onChange={(e) => setSelectedPlaylist(e.target.value)}
              className={`rounded-xl border px-2.5 py-2 text-xs font-semibold ${
                dark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <option value="all">Semua 12 Playlist</option>
              {videosData?.playlists.map((pl) => (
                <option key={pl.key} value={pl.key}>
                  {pl.title} ({pl.videoCount})
                </option>
              ))}
            </select>

            <select
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value)}
              className={`rounded-xl border px-2.5 py-2 text-xs font-semibold ${
                dark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <option value="all">Semua Bidang</option>
              {manifest.specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-slate-400">
            Menampilkan {filteredVideos.length} video rekaman kelas & pembahasan
          </p>

          <div className="space-y-2.5">
            {filteredVideos.slice(0, 60).map((v) => {
              const q = query.trim().toLowerCase();
              const matchingChapters = q
                ? v.chapters.filter(
                    (c) => c.keywords.toLowerCase().includes(q) || c.snippet.toLowerCase().includes(q)
                  )
                : v.chapters.slice(0, 3);

              return (
                <div
                  key={v.videoId}
                  className={`rounded-2xl border p-3.5 space-y-2 ${
                    dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold leading-snug">{v.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {v.playlistTitle} • {v.durationText || 'Video'} {v.hasTranscript ? '• ✓ Transkrip' : ''}
                      </p>
                    </div>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Buka
                    </a>
                  </div>

                  {matchingChapters.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {matchingChapters.slice(0, 4).map((ch, ci) => (
                        <a
                          key={ci}
                          href={`https://www.youtube.com/watch?v=${v.videoId}&t=${ch.t}s`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/50 px-2.5 py-1.5 text-[11px] hover:bg-rose-500/15"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-rose-300">{ch.keywords || 'Pembahasan'}</span>
                            <p className="truncate text-[10px] text-slate-400">{ch.snippet}</p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                            {ch.ts} <ExternalLink className="h-2.5 w-2.5" />
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'flashcards' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={fcSpec}
              onChange={(e) => setFcSpec(e.target.value)}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                dark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <option value="all">Acak Semua Bidang ({manifest.totalFlashcards} Kartu)</option>
              {manifest.specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shortName} ({s.flashcardCount} Kartu)
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setCards((prev) => shuffleArray(prev));
                setFcIdx(0);
                setFlipped(false);
              }}
              className="rounded-xl bg-emerald-600/20 p-2.5 text-emerald-400"
              title="Acak ulang kartu"
            >
              <Shuffle className="h-4 w-4" />
            </button>
          </div>

          {currentCard ? (
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  Kartu {fcIdx + 1} / {cards.length}
                </span>
                {currentCard.skdi && (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    SKDI {currentCard.skdi}
                  </span>
                )}
              </div>

              <div
                onClick={() => setFlipped((f) => !f)}
                className={`min-h-[260px] cursor-pointer rounded-3xl border p-5 flex flex-col justify-between transition ${
                  flipped
                    ? dark
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : 'border-emerald-300 bg-emerald-50'
                    : dark
                    ? 'border-slate-800 bg-slate-900'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    {flipped ? 'RINGKASAN MATERI & JAWABAN' : 'ACTIVE RECALL PROMPT'}
                  </span>
                  <h3 className="mt-2 text-base font-extrabold leading-snug">
                    {flipped ? currentCard.topic : currentCard.front}
                  </h3>
                  {flipped && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-200 whitespace-pre-line">
                      {currentCard.back}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-800/50 text-[11px] text-slate-400">
                  <span>{currentCard.sourceFile} (Hal. {currentCard.page})</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                    <FlipHorizontal className="h-3.5 w-3.5" /> Tap untuk balik
                  </span>
                </div>
              </div>

              {flipped && currentCard.videos?.[0] && (
                <a
                  href={currentCard.videos[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs"
                >
                  <span className="truncate font-semibold text-rose-200 pr-2">
                    ▶ {currentCard.videos[0].title}
                  </span>
                  <span className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 font-bold text-white">
                    {currentCard.videos[0].timestamp}
                  </span>
                </a>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    onRateFlashcard(currentCard, false);
                    setFlipped(false);
                    setFcIdx((i) => (i + 1) % cards.length);
                  }}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/15 py-3 text-xs font-extrabold text-rose-300"
                >
                  Belum Hafal (Ulangi)
                </button>
                <button
                  onClick={() => {
                    onRateFlashcard(currentCard, true);
                    setFlipped(false);
                    setFcIdx((i) => (i + 1) % cards.length);
                  }}
                  className="rounded-xl bg-emerald-600 py-3 text-xs font-extrabold text-white"
                >
                  Hafal Luar Kepala ✓
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 py-8">Memuat flashcards...</p>
          )}
        </div>
      )}
    </div>
  );
}
