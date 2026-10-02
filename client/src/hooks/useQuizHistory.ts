import { useCallback, useEffect, useState } from 'react';
import { createQuiz, listQuizzes } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { readLocal, writeLocal, STORAGE_KEYS } from '../storage/localStorage';
import type { QuizRecord } from '../types';

/**
 * Quiz history has two homes: local browser storage (always) and the account
 * API (when signed in). Local storage is the source of truth immediately so the
 * UI never blocks on the network; the server copy is layered on when available.
 */
export function useQuizHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<QuizRecord[]>(() => readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, []));
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setRecords(readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, []));
      setSynced(false);
      setLoading(false);
      return;
    }
    try {
      const serverRecords = await listQuizzes();
      setRecords(serverRecords);
      setSynced(true);
    } catch {
      setRecords(readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, []));
      setSynced(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Adds a record locally and, when signed in, to the account as well. */
  const addRecord = useCallback(
    async (record: QuizRecord) => {
      const local = [record, ...readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, [])].slice(0, 100);
      writeLocal(STORAGE_KEYS.quizHistory, local);
      setRecords(local);

      if (!user) return { saved: false as const };
      const { ok, data } = await createQuiz({
        project: record.project,
        language: record.language,
        difficulty: record.difficulty,
        score: record.score,
        total: record.total,
        percentage: record.percentage,
        conceptsToReview: record.conceptsToReview,
      });
      if (ok) await reload();
      return { saved: ok, message: data.message };
    },
    [user, reload],
  );

  return { records, loading, synced, reload, addRecord };
}
