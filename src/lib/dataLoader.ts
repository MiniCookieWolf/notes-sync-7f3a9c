import type { Flashcard, ManifestData, Question, VideosIndexData } from './types';

const BASE = import.meta.env.BASE_URL;

let manifestCache: ManifestData | null = null;
let videosCache: VideosIndexData | null = null;
const questionsCache = new Map<string, Question[]>();
const flashcardsCache = new Map<string, Flashcard[]>();

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadManifest(): Promise<ManifestData> {
  if (manifestCache) return manifestCache;
  manifestCache = await fetchJSON<ManifestData>(`${BASE}data/manifest.json`);
  return manifestCache;
}

export async function loadVideosIndex(): Promise<VideosIndexData> {
  if (videosCache) return videosCache;
  videosCache = await fetchJSON<VideosIndexData>(`${BASE}data/videos_index.json`);
  return videosCache;
}

export async function loadSpecialtyQuestions(specialty: string): Promise<Question[]> {
  const existing = questionsCache.get(specialty);
  if (existing) return existing;
  const data = await fetchJSON<Question[]>(`${BASE}data/questions/${specialty}.json`);
  questionsCache.set(specialty, data);
  return data;
}

export async function loadSpecialtyFlashcards(specialty: string): Promise<Flashcard[]> {
  const existing = flashcardsCache.get(specialty);
  if (existing) return existing;
  const data = await fetchJSON<Flashcard[]>(`${BASE}data/flashcards/${specialty}.json`);
  flashcardsCache.set(specialty, data);
  return data;
}

export async function loadAllQuestions(specialties: string[]): Promise<Question[]> {
  const chunks = await Promise.all(specialties.map((s) => loadSpecialtyQuestions(s)));
  return chunks.flat();
}

export async function loadAllFlashcards(specialties: string[]): Promise<Flashcard[]> {
  const chunks = await Promise.all(specialties.map((s) => loadSpecialtyFlashcards(s)));
  return chunks.flat();
}

export async function prefetchAllOfflineData(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<{ questions: number; flashcards: number; images: number }> {
  const manifest = await loadManifest();
  const specs = manifest.specialties.map((s) => s.id);
  const totalSteps = specs.length * 2 + 1;
  let done = 0;

  await loadVideosIndex();
  done += 1;
  onProgress?.(done, totalSteps, 'Indeks 138 Video & Timestamp');

  let qCount = 0;
  let fcCount = 0;
  const imgUrls = new Set<string>();

  for (const s of specs) {
    const qs = await loadSpecialtyQuestions(s);
    qCount += qs.length;
    for (const q of qs) {
      if (q.image) imgUrls.add(`${BASE}${q.image.replace(/^\/+/, '')}`);
    }
    done += 1;
    onProgress?.(done, totalSteps, `Bank soal ${s}`);

    const fcs = await loadSpecialtyFlashcards(s);
    fcCount += fcs.length;
    done += 1;
    onProgress?.(done, totalSteps, `Flashcards ${s}`);
  }

  // Warm cache for clinical images in small batches
  const imgList = Array.from(imgUrls);
  const batchSize = 8;
  for (let i = 0; i < imgList.length; i += batchSize) {
    await Promise.allSettled(imgList.slice(i, i + batchSize).map((u) => fetch(u)));
  }

  return { questions: qCount, flashcards: fcCount, images: imgList.length };
}
