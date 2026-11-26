export interface VideoRef {
  videoId: string;
  title: string;
  playlist: string;
  startSec: number;
  timestamp: string;
  url: string;
  snippet: string;
  matchType: 'exact_timestamp' | 'topic_timestamp' | 'specialty_video';
}

export interface Question {
  id: string;
  specialty: string;
  sourceBatch: string;
  sourceCategory: string;
  sourceFile: string;
  sourcePath?: string;
  qNum?: number | null;
  stem: string;
  options: Record<string, string>;
  answer: string;
  answerVerified: boolean;
  rationale: string;
  optionRationales: Record<string, string>;
  materiSummary: string;
  keywords: string[];
  image?: string | null;
  alsoIn?: string[];
  videos: VideoRef[];
}

export interface Flashcard {
  id: string;
  specialty: string;
  front: string;
  topic: string;
  back: string;
  skdi: string;
  sourceFile: string;
  page: number;
  videos: VideoRef[];
}

export interface SpecialtyMeta {
  id: string;
  name: string;
  shortName: string;
  weight: number;
  color: string;
  questionCount: number;
  verifiedCount: number;
  timestampedCount: number;
  flashcardCount: number;
}

export interface ManifestData {
  generatedAt: string;
  totalQuestions: number;
  verifiedQuestions: number;
  timestampedQuestions: number;
  exactTimestampQuestions: number;
  totalFlashcards: number;
  totalVideos: number;
  totalPlaylists: number;
  specialties: SpecialtyMeta[];
}

export interface VideoChapter {
  t: number;
  ts: string;
  keywords: string;
  snippet: string;
}

export interface VideoItem {
  videoId: string;
  title: string;
  playlistKey: string;
  playlistTitle: string;
  batch: string;
  category: string;
  specialties: string[];
  durationSec: number;
  durationText: string;
  hasTranscript: boolean;
  url: string;
  chapters: VideoChapter[];
}

export interface PlaylistMeta {
  key: string;
  id: string;
  title: string;
  batch: string;
  category: string;
  videoCount: number;
  url: string;
}

export interface VideosIndexData {
  playlists: PlaylistMeta[];
  videos: VideoItem[];
}

export interface SRSRecord {
  id: string;
  specialty: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueDate: string; // YYYY-MM-DD
  lastReviewed: string;
  lastCorrect: boolean;
  attempts: number;
  correctCount: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  answered: number;
  correct: number;
  flashcards: number;
  minutes: number;
  xp: number;
}

export interface StudyPlanConfig {
  examDate: string; // YYYY-MM-DD
  dailyMinutes: number;
  activeDays: number[]; // 0=Sun..6=Sat
  targetAccuracy: number; // e.g. 75
  reminderTime: string; // HH:mm
  notificationsEnabled: boolean;
}

export interface ScheduledDay {
  date: string;
  phase: 'Fondasi' | 'Penguatan' | 'Simulasi';
  specialties: string[];
  targetQuestions: number;
  targetSrs: number;
  targetFlashcards: number;
  estimatedMinutes: number;
  focusLabel: string;
}

export interface AppSettings {
  darkMode: boolean;
  haptics: boolean;
  activeRecallDefault: boolean;
  showKeywordsHint: boolean;
  userName: string;
}

export interface UserProgress {
  xp: number;
  streakDays: number;
  lastStudyDate: string;
  bestCombo: number;
  srs: Record<string, SRSRecord>;
  flashcardSrs: Record<string, SRSRecord>;
  bookmarks: string[];
  notes: Record<string, string>;
  dailyLogs: Record<string, DailyLog>;
  planConfig: StudyPlanConfig;
  scheduleOffsetDays: number;
  settings: AppSettings;
}

export interface QuizSessionConfig {
  title: string;
  subtitle: string;
  questions: Question[];
  mode: 'practice' | 'cbt' | 'review';
  activeRecallFirst: boolean;
  timeLimitSec?: number;
}
