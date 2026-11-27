import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Flag,
  Grid,
  Lightbulb,
  Sparkles,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { loadSpecialtyTopics } from '../lib/dataLoader';
import { triggerHaptic } from '../lib/motivation';
import type { SRSRating } from '../lib/srs';
import type { QuizSessionConfig, SpecialtyMeta, TopicDetail, UserProgress } from '../lib/types';
import { PembahasanCard } from './PembahasanCard';

interface QuizSessionProps {
  config: QuizSessionConfig;
  specialties: SpecialtyMeta[];
  progress: UserProgress;
  onRecordAnswer: (
    questionId: string,
    specialty: string,
    isCorrect: boolean,
    rating: SRSRating,
    elapsedSec: number
  ) => void;
  onToggleBookmark: (questionId: string) => void;
  onSaveNote: (questionId: string, note: string) => void;
  onExit: (summary?: { answered: number; correct: number; bySpec: Record<string, { total: number; correct: number }> }) => void;
}

export function QuizSession({
  config,
  specialties,
  progress,
  onRecordAnswer,
  onToggleBookmark,
  onSaveNote,
  onExit,
}: QuizSessionProps) {
  const [idx, setIdx] = useState(0);
  const [selectedByIdx, setSelectedByIdx] = useState<Record<number, string>>({});
  const [revealedByIdx, setRevealedByIdx] = useState<Record<number, boolean>>({});
  const [optionsUnlocked, setOptionsUnlocked] = useState(!config.activeRecallFirst);
  const [showKeywords, setShowKeywords] = useState(progress.settings.showKeywordsHint);
  const [combo, setCombo] = useState(0);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [showNavGrid, setShowNavGrid] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [ratedByIdx, setRatedByIdx] = useState<Record<number, SRSRating>>({});
  const [cbtSubmitted, setCbtSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(config.timeLimitSec || 0);
  const [questionStartMs, setQuestionStartMs] = useState(Date.now());
  const [topicsBySpec, setTopicsBySpec] = useState<Record<string, Record<string, TopicDetail>>>({});

  const dark = progress.settings.darkMode;
  const specMap = useMemo(() => Object.fromEntries(specialties.map((s) => [s.id, s])), [specialties]);
  const questions = config.questions;
  const q = questions[idx];

  useEffect(() => {
    setOptionsUnlocked(!config.activeRecallFirst || Boolean(revealedByIdx[idx]) || cbtSubmitted);
    setShowKeywords(progress.settings.showKeywordsHint);
    setQuestionStartMs(Date.now());
    if (q?.topicId && !topicsBySpec[q.specialty]) {
      loadSpecialtyTopics(q.specialty).then((map) => {
        setTopicsBySpec((prev) => ({ ...prev, [q.specialty]: map }));
      });
    }
  }, [idx, q?.id, q?.specialty, q?.topicId, config.activeRecallFirst, cbtSubmitted]);

  useEffect(() => {
    if (config.mode !== 'cbt' || cbtSubmitted || !config.timeLimitSec) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setCbtSubmitted(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [config.mode, config.timeLimitSec, cbtSubmitted]);

  if (!q) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Tidak ada soal pada filter ini.</p>
        <button onClick={() => onExit()} className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">
          Kembali
        </button>
      </div>
    );
  }

  const chosen = selectedByIdx[idx] || '';
  const isRevealed = config.mode === 'cbt' ? cbtSubmitted : Boolean(revealedByIdx[idx]);
  const isBookmarked = progress.bookmarks.includes(q.id);
  const specMeta = specMap[q.specialty];
  const imgUrl = q.image ? `${import.meta.env.BASE_URL}${q.image.replace(/^\/+/, '')}` : null;

  const fmtSec = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const handleSelectOption = (letter: string) => {
    if (config.mode !== 'cbt' && isRevealed) return;
    if (config.mode === 'cbt' && cbtSubmitted) return;

    setSelectedByIdx((prev) => ({ ...prev, [idx]: letter }));

    if (config.mode !== 'cbt') {
      setRevealedByIdx((prev) => ({ ...prev, [idx]: true }));
      const correct = q.answerVerified ? letter === q.answer : true;
      triggerHaptic(progress.settings.haptics, correct ? 15 : [25, 40, 25]);
      setCombo((c) => (correct ? c + 1 : 0));
      const elapsed = Math.max(5, Math.min(180, Math.round((Date.now() - questionStartMs) / 1000)));
      const autoRating: SRSRating = correct ? 'good' : 'again';
      setRatedByIdx((prev) => ({ ...prev, [idx]: autoRating }));
      onRecordAnswer(q.id, q.specialty, correct, autoRating, elapsed);
    } else {
      triggerHaptic(progress.settings.haptics, 10);
    }
  };

  const handleManualRating = (rating: SRSRating) => {
    const correct = q.answerVerified ? chosen === q.answer : rating !== 'again';
    setRatedByIdx((prev) => ({ ...prev, [idx]: rating }));
    triggerHaptic(progress.settings.haptics, 12);
    onRecordAnswer(q.id, q.specialty, correct, rating, 15);
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    }
  };

  const handleFinishCbt = () => {
    setCbtSubmitted(true);
    questions.forEach((item, i) => {
      const sel = selectedByIdx[i];
      if (!sel) return;
      const ok = item.answerVerified ? sel === item.answer : true;
      onRecordAnswer(item.id, item.specialty, ok, ok ? 'good' : 'again', 45);
    });
  };

  const finishAndClose = () => {
    const bySpec: Record<string, { total: number; correct: number }> = {};
    let answered = 0;
    let correct = 0;
    questions.forEach((item, i) => {
      const sel = selectedByIdx[i];
      if (!sel) return;
      answered += 1;
      const ok = item.answerVerified ? sel === item.answer : true;
      if (ok) correct += 1;
      if (!bySpec[item.specialty]) bySpec[item.specialty] = { total: 0, correct: 0 };
      bySpec[item.specialty].total += 1;
      if (ok) bySpec[item.specialty].correct += 1;
    });
    onExit({ answered, correct, bySpec });
  };

  // CBT Result Summary Banner
  const cbtScore = useMemo(() => {
    if (!cbtSubmitted) return null;
    let total = 0;
    let ok = 0;
    const perSpec: Record<string, { t: number; c: number }> = {};
    questions.forEach((item, i) => {
      if (!item.answerVerified) return;
      total += 1;
      const good = selectedByIdx[i] === item.answer;
      if (good) ok += 1;
      if (!perSpec[item.specialty]) perSpec[item.specialty] = { t: 0, c: 0 };
      perSpec[item.specialty].t += 1;
      if (good) perSpec[item.specialty].c += 1;
    });
    return { total, ok, pct: total ? Math.round((ok / total) * 100) : 0, perSpec };
  }, [cbtSubmitted, questions, selectedByIdx]);

  return (
    <div className={`min-h-screen pb-28 ${dark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Quiz Header */}
      <header
        className={`sticky top-0 z-30 border-b px-3 py-2.5 backdrop-blur-md ${
          dark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <button
            onClick={finishAndClose}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
              dark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            Selesai
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold tracking-wide">
              Soal {idx + 1} / {questions.length}
            </span>
            <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{config.title}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {config.mode === 'cbt' && (
              <span
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-mono font-bold ${
                  secondsLeft < 300 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {fmtSec(secondsLeft)}
              </span>
            )}
            {combo >= 2 && config.mode !== 'cbt' && (
              <span className="flex items-center gap-0.5 rounded-lg bg-orange-500/20 px-2 py-1 text-xs font-bold text-orange-400">
                <Flame className="h-3.5 w-3.5" />
                {combo}x
              </span>
            )}
            <button
              onClick={() => setShowNavGrid(true)}
              className={`rounded-xl p-1.5 ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              title="Daftar Nomor"
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mx-auto mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-slate-800/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* CBT End-of-Exam Summary Card */}
        {cbtSubmitted && cbtScore && (
          <div
            className={`rounded-2xl border p-4 ${
              cbtScore.pct >= 66
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-rose-500/40 bg-rose-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hasil Simulasi CBT</p>
                <h3 className="text-2xl font-extrabold">
                  {cbtScore.pct}% ({cbtScore.ok}/{cbtScore.total})
                </h3>
                <p className="text-xs mt-0.5">
                  {cbtScore.pct >= 66 ? '✅ LULUS Ambang Batas UKMPPD (≥66%)' : '⚠️ Belum mencapai 66% — Review pembahasan di bawah!'}
                </p>
              </div>
              <button
                onClick={finishAndClose}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                Simpan & Keluar
              </button>
            </div>
          </div>
        )}

        {/* Specialty + Source Badges & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: specMeta?.color || '#10b981' }}
            >
              {specMeta?.shortName || q.specialty}
            </span>
            <span className="rounded-full bg-slate-800/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
              {q.sourceBatch} • {q.sourceCategory.replace('_', ' ')}
            </span>
            {!q.answerVerified && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                Mode Review TO
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setFlagged((prev) => {
                  const next = new Set(prev);
                  if (next.has(idx)) next.delete(idx);
                  else next.add(idx);
                  return next;
                });
              }}
              className={`rounded-lg p-1.5 ${
                flagged.has(idx)
                  ? 'bg-amber-500/20 text-amber-400'
                  : dark
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-slate-200 text-slate-600'
              }`}
              title="Tandai ragu-ragu"
            >
              <Flag className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggleBookmark(q.id)}
              className={`rounded-lg p-1.5 ${
                isBookmarked
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : dark
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-slate-200 text-slate-600'
              }`}
              title="Simpan bookmark"
            >
              <Bookmark className="h-4 w-4" fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Vignette Card */}
        <article
          className={`rounded-2xl border p-4 shadow-sm ${
            dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <p className={`${progress.settings.fontSize === 'large' ? 'text-[17px]' : 'text-[15px]'} leading-relaxed whitespace-pre-line`}>{q.stem}</p>

          {imgUrl && (
            <div className="mt-3 relative">
              <img
                src={imgUrl}
                alt="Gambar Klinis Kasus"
                onClick={() => setZoomImage(imgUrl)}
                className="max-h-64 w-full cursor-zoom-in rounded-xl border border-slate-700/50 object-contain bg-black/30"
              />
              <button
                onClick={() => setZoomImage(imgUrl)}
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] text-white"
              >
                <ZoomIn className="h-3.5 w-3.5" /> Zoom
              </button>
            </div>
          )}

          {/* Clinical Keywords Hint Toggle */}
          {q.keywords && q.keywords.length > 0 && (
            <div className="mt-3">
              {!showKeywords ? (
                <button
                  onClick={() => setShowKeywords(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Intip Kata Kunci Klinis ({q.keywords.length})
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5 rounded-xl bg-cyan-500/10 p-2.5">
                  <span className="text-[11px] font-semibold text-cyan-400 mr-1">Kata Kunci:</span>
                  {q.keywords.map((kw, i) => (
                    <span key={i} className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[11px] text-cyan-200">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </article>

        {/* Active Recall First Gate */}
        {!optionsUnlocked ? (
          <div
            className={`rounded-2xl border p-5 text-center space-y-3 ${
              dark ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold">Mode Active Recall Aktif!</h4>
              <p className="mt-1 text-xs text-slate-400">
                Pikirkan diagnosis, pemeriksaan penunjang, atau tatalaksana terbaik di kepala Anda sebelum melihat pilihan A–E.
              </p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(progress.settings.haptics, 10);
                setOptionsUnlocked(true);
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 active:scale-[0.98]"
            >
              <Eye className="h-4 w-4" />
              Saya Sudah Menebak — Tampilkan Opsi A–E
            </button>
          </div>
        ) : (
          /* Options List A-E */
          <div className="space-y-2.5">
            {(['A', 'B', 'C', 'D', 'E'] as const)
              .filter((k) => q.options[k])
              .map((letter) => {
                const isSelected = chosen === letter;
                const isAnswer = q.answerVerified && q.answer === letter;
                let style = dark
                  ? 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  : 'border-slate-200 bg-white hover:border-slate-300';

                if (isRevealed) {
                  if (isAnswer) {
                    style = 'border-emerald-500 bg-emerald-500/15 text-emerald-300';
                  } else if (isSelected && q.answerVerified && !isAnswer) {
                    style = 'border-rose-500 bg-rose-500/15 text-rose-300';
                  } else {
                    style = dark ? 'border-slate-800/60 bg-slate-900/50 opacity-75' : 'border-slate-200 bg-slate-50 opacity-75';
                  }
                } else if (isSelected) {
                  style = 'border-cyan-500 bg-cyan-500/15';
                }

                return (
                  <button
                    key={letter}
                    onClick={() => handleSelectOption(letter)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] ${style}`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                        isRevealed && isAnswer
                          ? 'bg-emerald-500 text-white'
                          : isRevealed && isSelected && q.answerVerified && !isAnswer
                          ? 'bg-rose-500 text-white'
                          : isSelected
                          ? 'bg-cyan-500 text-white'
                          : dark
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className={`flex-1 leading-snug ${progress.settings.fontSize === 'large' ? 'text-[15px]' : 'text-sm'}`}>{q.options[letter]}</span>
                    {isRevealed && isAnswer && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />}
                    {isRevealed && isSelected && q.answerVerified && !isAnswer && (
                      <XCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                    )}
                  </button>
                );
              })}
          </div>
        )}

        {/* Rich Pembahasan + Video Timestamp Card */}
        {isRevealed && (
          <PembahasanCard
            q={q}
            chosen={chosen}
            topic={q.topicId ? topicsBySpec[q.specialty]?.[q.topicId] : null}
            dark={dark}
            mode={config.mode}
            rated={ratedByIdx[idx]}
            savedNote={progress.notes[q.id] || ''}
            onRate={handleManualRating}
            onSaveNote={(note) => onSaveNote(q.id, note)}
            onZoomImage={(url) => setZoomImage(url)}
          />
        )}
      </main>

      {/* Bottom Prev / Next Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 border-t px-4 py-3 safe-bottom backdrop-blur-lg ${
          dark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white/95'
        }`}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <button
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold disabled:opacity-35"
          >
            <ArrowLeft className="h-4 w-4" /> Prev
          </button>

          {config.mode === 'cbt' && !cbtSubmitted && (
            <button
              onClick={handleFinishCbt}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white"
            >
              Kumpulkan TO
            </button>
          )}

          {idx + 1 < questions.length ? (
            <button
              onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow-md shadow-emerald-600/20"
            >
              Soal Berikutnya <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finishAndClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 py-2.5 text-xs font-extrabold text-white"
            >
              Tuntaskan Sesi ✓
            </button>
          )}
        </div>
      </div>

      {/* Question Navigator Modal */}
      {showNavGrid && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className={`w-full max-w-lg rounded-3xl p-5 max-h-[80vh] overflow-y-auto ${dark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">Navigasi Nomor ({questions.length} Soal)</h3>
              <button onClick={() => setShowNavGrid(false)} className="rounded-full p-1 bg-slate-800 text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {questions.map((item, i) => {
                const answered = Boolean(selectedByIdx[i]);
                const isFlg = flagged.has(i);
                const isCur = i === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setIdx(i);
                      setShowNavGrid(false);
                    }}
                    className={`rounded-xl py-2 text-xs font-bold border ${
                      isCur
                        ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                        : isFlg
                        ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                        : answered
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-800 bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Lightbox */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
        >
          <button className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white">
            <X className="h-6 w-6" />
          </button>
          <img src={zoomImage} alt="Zoom Klinis" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
