import type { LocalAnalysis, ExecutionResult, DeepAnalysis, StoredProject, QuizRecord } from '../types';

/**
 * Versioned localStorage keys. Bumping the `v1` segment is the migration
 * strategy: unknown or malformed values are discarded rather than trusted.
 */
export const STORAGE_KEYS = {
  settings: 'codementor:v1:settings',
  draft: 'codementor:v1:draft',
  projects: 'codementor:v1:projects',
  quizHistory: 'codementor:v1:quiz-history',
  accountImports: 'codementor:v1:account-imports',
  localAnalysis: 'codementor:v1:latest-local-analysis',
  deepAnalysis: 'codementor:v1:latest-deep-analysis',
  latestExecution: 'codementor:v1:latest-execution',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Only these keys may ever be removed by "clear local data". */
export const CLEARABLE_KEYS: StorageKey[] = Object.values(STORAGE_KEYS);

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted JSON should never break the app; drop the bad value.
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or disabled (private mode). The app stays usable.
  }
}

export function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearCodeMentorData(): void {
  CLEARABLE_KEYS.forEach(removeLocal);
}

/** Typed convenience readers used across the app. */
export const storage = {
  readDraft(): { code: string; language: string; projectTitle: string; stdin: string } | null {
    return readLocal(STORAGE_KEYS.draft, null);
  },
  readProjects(): StoredProject[] {
    return readLocal<StoredProject[]>(STORAGE_KEYS.projects, []);
  },
  readQuizHistory(): QuizRecord[] {
    return readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, []);
  },
  readLocalAnalysis(): LocalAnalysis | null {
    return readLocal<LocalAnalysis | null>(STORAGE_KEYS.localAnalysis, null);
  },
  readDeepAnalysis(): DeepAnalysis | null {
    return readLocal<DeepAnalysis | null>(STORAGE_KEYS.deepAnalysis, null);
  },
  readExecution(): ExecutionResult | null {
    return readLocal<ExecutionResult | null>(STORAGE_KEYS.latestExecution, null);
  },
};
