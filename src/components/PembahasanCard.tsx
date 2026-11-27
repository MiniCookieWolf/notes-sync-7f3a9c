import { useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  MessageSquarePlus,
  PlayCircle,
  Sparkles,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import type { SRSRating } from '../lib/srs';
import type { Question, TopicDetail } from '../lib/types';

interface PembahasanCardProps {
  q: Question;
  chosen: string;
  topic?: TopicDetail | null;
  dark: boolean;
  mode: 'practice' | 'cbt' | 'review';
  rated?: SRSRating;
  savedNote: string;
  onRate: (rating: SRSRating) => void;
  onSaveNote: (note: string) => void;
  onZoomImage: (url: string) => void;
}

const LEAD_PHRASES = [
  'Alasan jawaban benar:',
  'Jawaban benar:',
  'Diagnosis:',
  'Mekanisme:',
  'Patofisiologi:',
  'Tatalaksana:',
  'Terapi:',
  'Gold standard:',
  'Pemeriksaan penunjang:',
  'Klasifikasi:',
  'Rasional:',
  'Kesimpulan:',
  'Catatan:',
];

function renderFormattedLine(raw: string, idx: number) {
  const clean = raw.replace(/^•\s*/, '').trim();
  if (!clean) return null;

  // Highlight known clinical lead-ins or `Label:` prefixes
  const colonIdx = clean.indexOf(':');
  const hasLead =
    LEAD_PHRASES.some((p) => clean.toLowerCase().startsWith(p.toLowerCase())) ||
    (colonIdx > 2 && colonIdx <= 28 && !clean.slice(0, colonIdx).includes('. '));

  if (clean.endsWith(':')) {
    return (
      <p key={idx} className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 pt-1">
        {clean}
      </p>
    );
  }

  return (
    <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
      <p className="flex-1">
        {hasLead && colonIdx > 0 ? (
          <>
            <strong className="font-bold text-emerald-300">{clean.slice(0, colonIdx + 1)}</strong>
            {clean.slice(colonIdx + 1)}
          </>
        ) : (
          clean
        )}
      </p>
    </div>
  );
}

const TRAILING_JOIN_WORDS = new Set([
  'dan', 'atau', 'yang', 'dengan', 'pada', 'di', 'ke', 'dari', 'untuk',
  'seperti', 'yaitu', 'adalah', 'karena', 'sehingga', 'namun', 'tetapi',
  'oleh', 'dalam', 'serta', 'dapat', 'tidak', 'saat', 'jika', 'bila',
  'secara', 'antara', 'terhadap', 'akibat', 'berupa', 'melalui', 'hingga',
  'sampai', 'sebagai', 'sejak', 'maupun', 'bahkan', 'lebih', 'kurang',
  'paling', 'sangat', 'bahwa', 'agar', 'supaya',
]);

function startsNewItem(line: string): boolean {
  if (/^(?:[•∙▪‣→]|->|-\s+|\d+[.)]\s+|[A-E][.)]\s+|[A-E](?:\s+Salah)?\s*:)/i.test(line)) {
    return true;
  }
  const colonIdx = line.indexOf(':');
  if (colonIdx > 2 && colonIdx <= 28 && !line.slice(0, colonIdx).includes('. ')) {
    return true;
  }
  return false;
}

function mergeWrappedLines(rawLines: string[]): string[] {
  const out: string[] = [];
  for (const raw of rawLines) {
    const cur = raw.trim();
    if (!cur) continue;
    if (out.length === 0) {
      out.push(cur);
      continue;
    }
    const prev = out[out.length - 1];
    const prevEndsSentence = /[.!?:;]$/.test(prev);
    const prevEndsConnector = /[,+/(\-–—]$/.test(prev);
    const prevWords = prev.replace(/[^\w\s]/g, ' ').trim().split(/\s+/);
    const lastWord = (prevWords[prevWords.length - 1] || '').toLowerCase();
    const curStartsLower = /^[a-z0-9(%]/.test(cur);

    if (
      !startsNewItem(cur) &&
      !prevEndsSentence &&
      (curStartsLower || prevEndsConnector || TRAILING_JOIN_WORDS.has(lastWord))
    ) {
      out[out.length - 1] = `${prev} ${cur}`;
    } else {
      out.push(cur);
    }
  }
  return out;
}

export function PembahasanCard({
  q,
  chosen,
  topic,
  dark,
  mode,
  rated,
  savedNote,
  onRate,
  onSaveNote,
  onZoomImage,
}: PembahasanCardProps) {
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteDraft, setNoteDraft] = useState(savedNote);
  const [showTopicExpanded, setShowTopicExpanded] = useState(true);

  const base = import.meta.env.BASE_URL;
  const isCorrect = q.answerVerified ? chosen === q.answer : true;
  const rationaleLines = mergeWrappedLines(
    (q.rationale || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );

  const hasOptionRationales = q.optionRationales && Object.keys(q.optionRationales).length > 0;
  const slideSections = (q.materiSections || []).map((sec) => ({
    ...sec,
    bullets: mergeWrappedLines(sec.bullets || []),
  }));
  const topicSections = (topic?.sections || []).map((sec) => ({
    ...sec,
    bullets: mergeWrappedLines(sec.bullets || []),
  }));

  // Combine mnemonics from question + linked topic without duplicates
  const allMnemonics = Array.from(
    new Set([...(q.mnemonics || []), ...(topic?.mnemonics || [])])
  ).slice(0, 6);

  // Combine visual diagrams/tables from question explanation slides + linked topic
  const visualImages = Array.from(
    new Set([
      ...(q.explanationImages || []).map((p) => `${base}${p.replace(/^\/+/, '')}`),
      ...(topic?.slideImages || []).map((p) => `${base}${p.replace(/^\/+/, '')}`),
    ])
  ).slice(0, 3);

  const skdiBadge =
    slideSections.find((s) => s.skdi)?.skdi || topic?.skdi || '';

  return (
    <section
      className={`space-y-4 rounded-3xl border p-4 shadow-sm ${
        dark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white'
      }`}
    >
      {/* 1. Result Banner + Key + SKDI */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
        <div className="flex items-center gap-2">
          {q.answerVerified ? (
            isCorrect ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-1 text-xs font-extrabold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Benar • Kunci {q.answer}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-3 py-1 text-xs font-extrabold text-rose-300">
                <XCircle className="h-4 w-4" /> Jawabanmu {chosen || '-'} • Kunci {q.answer}
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1 text-xs font-extrabold text-amber-300">
              <BookOpenCheck className="h-4 w-4" /> Pembahasan Review TO
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {skdiBadge && (
            <span className="rounded-lg bg-cyan-500/15 px-2 py-0.5 text-[11px] font-extrabold text-cyan-300">
              SKDI {skdiBadge}
            </span>
          )}
        </div>
      </div>

      {/* 2. Inti Pembahasan (Kenapa Jawaban Ini Benar) */}
      {rationaleLines.length > 0 && (
        <div
          className={`space-y-2 rounded-2xl border-l-4 border-emerald-500 p-3.5 ${
            dark ? 'bg-slate-950/70 text-slate-200' : 'bg-emerald-50/70 text-slate-800'
          }`}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
            Inti Pembahasan
          </p>
          <div className="space-y-1.5">
            {rationaleLines.map((ln, i) => renderFormattedLine(ln, i))}
          </div>
        </div>
      )}

      {/* 3. Analisis Opsi A-E */}
      {hasOptionRationales && (
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Analisis Pilihan A–E
          </p>
          <div className="space-y-1.5">
            {(['A', 'B', 'C', 'D', 'E'] as const)
              .filter((l) => q.optionRationales[l])
              .map((l) => {
                const isKey = q.answer === l;
                return (
                  <div
                    key={l}
                    className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                      isKey
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                        : dark
                        ? 'border-slate-800 bg-slate-950/50 text-slate-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold ${
                        isKey ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {l}
                    </span>
                    <p className="flex-1">{q.optionRationales[l]}</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 4. Jembatan Keledai / Mnemonic Callout */}
      {allMnemonics.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
            <Sparkles className="h-3.5 w-3.5" /> Jembatan Keledai & Poin Hafalan
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMnemonics.map((mn, i) => (
              <span
                key={i}
                className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-200"
              >
                {mn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. Detail Penyakit, Klasifikasi & Ringkasan Slide Mediko */}
      {(slideSections.length > 0 || topic || q.materiSummary) && (
        <div
          className={`rounded-2xl border p-3.5 space-y-3 ${
            dark ? 'border-cyan-500/25 bg-cyan-950/15' : 'border-cyan-200 bg-cyan-50/50'
          }`}
        >
          <button
            type="button"
            onClick={() => setShowTopicExpanded((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
              <Layers className="h-3.5 w-3.5" />
              {topic ? `Materi & Klasifikasi: ${topic.title}` : 'Klasifikasi & Ringkasan Materi'}
            </span>
            {showTopicExpanded ? (
              <ChevronUp className="h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-cyan-400" />
            )}
          </button>

          {showTopicExpanded && (
            <div className="space-y-3 pt-1">
              {/* Question-level slide sections (Baper / SPend / TO Akbar / Drilling) */}
              {slideSections.map((sec, sIdx) => (
                <div
                  key={`qsec-${sIdx}`}
                  className={`rounded-xl p-3 space-y-1.5 ${
                    dark ? 'bg-slate-950/60' : 'bg-white'
                  }`}
                >
                  <p className="text-xs font-extrabold text-cyan-300">{sec.heading}</p>
                  <div className="space-y-1">
                    {sec.bullets.map((b, bi) => (
                      <div key={bi} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Linked Disease/Classification Knowledge Card from Nov/Agt Materi */}
              {topic &&
                topicSections.map((sec, tIdx) => (
                  <div
                    key={`tsec-${tIdx}`}
                    className={`rounded-xl p-3 space-y-1.5 ${
                      dark ? 'bg-slate-950/60' : 'bg-white'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-emerald-300">{sec.heading}</p>
                    <div className="space-y-1">
                      {sec.bullets.map((b, bi) => (
                        <div key={bi} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {/* Fallback flat summary if legacy item without sections */}
              {slideSections.length === 0 && !topic && q.materiSummary && (
                <p className="text-xs leading-relaxed text-slate-200">{q.materiSummary}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Gambar / Tabel / Diagram Pembahasan */}
      {visualImages.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-violet-400">
            <ImageIcon className="h-3.5 w-3.5" />
            Diagram, Tabel & Gambar Terkait ({visualImages.length})
          </p>
          <div className={`grid gap-2 ${visualImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {visualImages.map((imgSrc, idx) => (
              <div
                key={idx}
                onClick={() => onZoomImage(imgSrc)}
                className="group relative cursor-zoom-in overflow-hidden rounded-2xl border border-slate-700/70 bg-black/30"
              >
                <img
                  src={imgSrc}
                  alt={`Slide pembahasan ${idx + 1}`}
                  className="max-h-56 w-full object-contain"
                />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <ZoomIn className="h-3 w-3" /> Perbesar
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Video Pembahasan & Timestamp */}
      {q.videos && q.videos.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-400">
            <PlayCircle className="h-3.5 w-3.5" />
            Link Video & Timestamp Pembahasan
          </p>
          {q.videos.map((v, vi) => (
            <a
              key={vi}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 transition hover:bg-rose-500/20 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-rose-200 truncate">{v.title}</p>
                  <p className="text-[10px] text-rose-300/75 truncate">{v.playlist}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-extrabold text-white">
                  ▶ {v.timestamp}
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
              {v.snippet && (
                <p className="text-[11px] italic text-slate-300/90 line-clamp-2">
                  "{v.snippet}"
                </p>
              )}
            </a>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-500">Sumber: {q.sourceFile}</p>

      {/* 8. Catatan Pribadi */}
      <div>
        {!showNoteBox ? (
          <button
            onClick={() => {
              setNoteDraft(savedNote);
              setShowNoteBox(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {savedNote ? 'Edit Catatan Pribadi' : 'Tambah Catatan / Mnemonic Sendiri'}
          </button>
        ) : (
          <div className="space-y-2 pt-1">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Tulis jembatan keledai atau catatan klinis pribadimu..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNoteBox(false)}
                className="rounded-lg px-3 py-1 text-xs text-slate-400"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onSaveNote(noteDraft);
                  setShowNoteBox(false);
                }}
                className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-bold text-white"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 9. Active Recall SRS Buttons */}
      {mode !== 'cbt' && (
        <div className="border-t border-slate-800 pt-3">
          <p className="mb-2 text-[11px] font-semibold text-slate-400">
            Jadwalkan Ulang Memori (Active Recall SRS):
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onRate('again')}
              className={`rounded-xl border py-2 text-xs font-bold ${
                rated === 'again'
                  ? 'border-rose-500 bg-rose-500/25 text-rose-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              Ulangi Besok
            </button>
            <button
              onClick={() => onRate('hard')}
              className={`rounded-xl border py-2 text-xs font-bold ${
                rated === 'hard'
                  ? 'border-amber-500 bg-amber-500/25 text-amber-200'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              Masih Ragu
            </button>
            <button
              onClick={() => onRate('easy')}
              className={`rounded-xl border py-2 text-xs font-bold ${
                rated === 'easy'
                  ? 'border-emerald-500 bg-emerald-500/25 text-emerald-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              Paham Banget
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
