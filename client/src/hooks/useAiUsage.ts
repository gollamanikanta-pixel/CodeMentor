import { useCallback, useEffect, useState } from 'react';
import { getAiUsage } from '../api/client';

export type AiUsage = {
  remaining: number;
  limit: number;
  configured: boolean;
  cooldownSeconds: number;
};

const FALLBACK: AiUsage = { remaining: 0, limit: 3, configured: false, cooldownSeconds: 30 };

/**
 * Reads fair-use accounting from the backend. Failures degrade gracefully to
 * "not configured" so local learning never depends on the API being up.
 */
export function useAiUsage() {
  const [usage, setUsage] = useState<AiUsage>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getAiUsage();
      setUsage({ ...FALLBACK, ...data });
    } catch {
      setUsage(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { usage, loading, refresh };
}
