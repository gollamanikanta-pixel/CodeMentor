import { useCallback, useEffect, useState } from 'react';
import { createQuiz, listQuizzes } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { readLocal, writeLocal, STORAGE_KEYS } from '../storage/localStorage';
import type { QuizRecord } from '../types';

export function useQuizHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<QuizRecord[]>(() =>
    user ? [] : readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, []),
  );
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user) {
      setRecords(readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, []));
      setSynced(false);
      setLoading(false);
      return;
    }
    setRecords([]);
    setSynced(false);
    try {
      const serverRecords = await listQuizzes();
      setRecords(serverRecords);
      setSynced(true);
    } catch {
      setRecords([]);
      setError('Your account quiz history could not be loaded. Browser-only history is not shown as account data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Signed-in quiz results are saved only by the protected account API. */
  const addRecord = useCallback(
    async (record: QuizRecord) => {
      if (!user) {
        const local = [record, ...readLocal<QuizRecord[]>(STORAGE_KEYS.quizHistory, [])].slice(0, 100);
        writeLocal(STORAGE_KEYS.quizHistory, local);
        setRecords(local);
        return { saved: true as const, local: true as const };
      }
      try {
        const { ok, data } = await createQuiz({
          project: record.project,
          projectId: record.projectId,
          language: record.language,
          difficulty: record.difficulty,
          score: record.score,
          total: record.total,
          percentage: record.percentage,
          conceptsToReview: record.conceptsToReview,
        });
        if (!ok) {
          const message = data.message || 'Quiz could not be saved to your account.';
          setError(message);
          return { saved: false as const, message };
        }
        setRecords((current) => [data.quiz, ...current.filter((item) => item.id !== data.quiz.id)].slice(0, 100));
        setSynced(true);
        return { saved: true as const, local: false as const };
      } catch {
        const message = 'Quiz could not be saved to your account. No browser-only copy was created.';
        setError(message);
        return { saved: false as const, message };
      }
    },
    [user, reload],
  );

  return { records, loading, synced, error, reload, addRecord };
}
