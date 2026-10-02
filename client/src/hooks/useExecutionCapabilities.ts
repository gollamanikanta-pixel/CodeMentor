import { useCallback, useEffect, useState } from 'react';
import { getExecutionCapabilities, type ExecutionCapabilities } from '../api/client';

/**
 * Reads real secure-runner readiness from the backend. The backend probes the
 * runner (it does not assume), so this never reports a capability that is not
 * actually available. Failures degrade to `null`, leaving the static language
 * status in place rather than inventing readiness.
 */
export function useExecutionCapabilities() {
  const [capabilities, setCapabilities] = useState<ExecutionCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await getExecutionCapabilities();
    setCapabilities(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Readiness for one language key (`c`, `cpp`, `java`). */
  const capabilityFor = useCallback(
    (languageKey?: string) => {
      if (!languageKey || !capabilities) return null;
      return capabilities.languages[languageKey] ?? null;
    },
    [capabilities],
  );

  return { capabilities, capabilityFor, loading, refresh };
}
