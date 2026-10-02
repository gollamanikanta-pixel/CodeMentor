import { useCallback, useEffect, useState } from 'react';
import { getAiUsage } from '../api/client';

export type AiUsage = {
  configured: boolean;
};

const FALLBACK: AiUsage = { configured: false };

/**
 * Reads AI provider readiness from the backend. Failures degrade gracefully to
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
