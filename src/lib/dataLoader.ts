import type { Flashcard, ManifestData, Question, TopicDetail, VideosIndexData } from './types';

const BASE = import.meta.env.BASE_URL;

let manifestCache: ManifestData | null = null;
let videosCache: VideosIndexData | null = null;
const questionsCache = new Map<string, Question[]>();
const questions2025Cache = new Map<string, Question[]>();
const flashcardsCache = new Map<string, Flashcard[]>();
const topicsCache = new Map<string, Record<string, TopicDetail>>();

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

export async function loadSpecialtyQuestions2025(specialty: string): Promise<Question[]> {
  const existing = questions2025Cache.get(specialty);
  if (existing) return existing;
  try {
    const data = await fetchJSON<Question[]>(`${BASE}data/questions_2025/${specialty}.json`);
    questions2025Cache.set(specialty, data);
    return data;
  } catch {
    return [];
  }
}

export async function loadSpecialtyQuestions(
  specialty: string,
  includeExtra2025 = false
): Promise<Question[]> {
  let base = questionsCache.get(specialty);
  if (!base) {
    base = await fetchJSON<Question[]>(`${BASE}data/questions/${specialty}.json`);
    questionsCache.set(specialty, base);
  }
  if (!includeExtra2025) return base;
  const extra = await loadSpecialtyQuestions2025(specialty);
  return extra.length > 0 ? [...base, ...extra] : base;
}

export async function loadSpecialtyFlashcards(specialty: string): Promise<Flashcard[]> {
  const existing = flashcardsCache.get(specialty);
  if (existing) return existing;
  const data = await fetchJSON<Flashcard[]>(`${BASE}data/flashcards/${specialty}.json`);
  flashcardsCache.set(specialty, data);
  return data;
}

export async function loadSpecialtyTopics(specialty: string): Promise<Record<string, TopicDetail>> {
  const existing = topicsCache.get(specialty);
  if (existing) return existing;
  try {
    const list = await fetchJSON<TopicDetail[]>(`${BASE}data/topics/${specialty}.json`);
    const map: Record<string, TopicDetail> = {};
    for (const tp of list) map[tp.id] = tp;
    topicsCache.set(specialty, map);
    return map;
  } catch {
    return {};
  }
}

export async function loadAllQuestions(
  specialties: string[],
  includeExtra2025 = false
): Promise<Question[]> {
  const chunks = await Promise.all(
    specialties.map((s) => loadSpecialtyQuestions(s, includeExtra2025))
  );
  return chunks.flat();
}

export async function loadAllFlashcards(specialties: string[]): Promise<Flashcard[]> {
  const chunks = await Promise.all(specialties.map((s) => loadSpecialtyFlashcards(s)));
  return chunks.flat();
}

export async function prefetchAllOfflineData(
  onProgress?: (done: number, total: number, label: string) => void,
  includeExtra2025 = false
): Promise<{ questions: number; flashcards: number; images: number }> {
  const manifest = await loadManifest();
  const specs = manifest.specialties.map((s) => s.id);
  const totalSteps = specs.length * 2 + 1;
  let done = 0;

  await loadVideosIndex();
  done += 1;
  onProgress?.(done, totalSteps, 'Indeks Video & Timestamp');

  let qCount = 0;
  let fcCount = 0;
  const imgUrls = new Set<string>();

  for (const s of specs) {
    const qs = await loadSpecialtyQuestions(s, includeExtra2025);
    qCount += qs.length;
    for (const q of qs) {
      if (q.image) imgUrls.add(`${BASE}${q.image.replace(/^\/+/, '')}`);
      for (const ei of q.explanationImages || []) {
        imgUrls.add(`${BASE}${ei.replace(/^\/+/, '')}`);
      }
    }
    done += 1;
    onProgress?.(done, totalSteps, `Bank soal ${s}`);

    const fcs = await loadSpecialtyFlashcards(s);
    fcCount += fcs.length;
    await loadSpecialtyTopics(s);
    done += 1;
    onProgress?.(done, totalSteps, `Flashcards & materi ${s}`);
  }

  // Warm cache for clinical images in small batches
  const imgList = Array.from(imgUrls);
  const batchSize = 8;
  for (let i = 0; i < imgList.length; i += batchSize) {
    await Promise.allSettled(imgList.slice(i, i + batchSize).map((u) => fetch(u)));
  }

  return { questions: qCount, flashcards: fcCount, images: imgList.length };
}
