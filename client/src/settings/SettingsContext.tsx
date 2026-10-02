import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { normalizeSettings, type CodeMentorSettings } from './defaults';
import { readLocal, writeLocal, STORAGE_KEYS } from '../storage/localStorage';
import { useAuth } from '../auth/AuthContext';
import { getAccountSettings, updateAccountSettings } from '../api/client';

type SettingsContextValue = {
  settings: CodeMentorSettings;
  update: <K extends keyof CodeMentorSettings>(key: K, value: CodeMentorSettings[K]) => void;
  reset: () => void;
  synced: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function resolveTheme(preference: CodeMentorSettings['theme'], prefersDark: boolean): 'dark' | 'light' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CodeMentorSettings>(() =>
    normalizeSettings(readLocal(STORAGE_KEYS.settings, null)),
  );
  const [synced, setSynced] = useState(false);
  const hydratedFor = useRef<string | null>(null);
  const userRef = useRef<string | null>(null);
  userRef.current = user?.id ?? null;

  const update = useCallback<SettingsContextValue['update']>((key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (userRef.current) {
      void updateAccountSettings({ [key]: value })
        .then(({ ok }) => setSynced(ok))
        .catch(() => setSynced(false));
    }
  }, []);

  const reset = useCallback(() => {
    const defaults = normalizeSettings(null);
    setSettings(defaults);
    if (userRef.current) {
      void updateAccountSettings(defaults)
        .then(({ ok }) => setSynced(ok))
        .catch(() => setSynced(false));
    }
  }, []);

  // Local persistence is always active.
  useEffect(() => {
    writeLocal(STORAGE_KEYS.settings, settings);
  }, [settings]);

  // When a learner signs in, adopt the account's saved settings once.
  useEffect(() => {
    if (!user) {
      hydratedFor.current = null;
      setSynced(false);
      return;
    }
    if (hydratedFor.current === user.id) return;
    hydratedFor.current = user.id;
    setSynced(false);
    void (async () => {
      const remote = await getAccountSettings();
      if (remote) {
        setSettings((current) => normalizeSettings({ ...current, ...remote }));
        setSynced(true);
      } else {
        setSynced(false);
      }
    })();
  }, [user]);

  // Push the full settings snapshot once after hydration so a new account starts
  // from the learner's local preferences rather than server defaults.
  useEffect(() => {
    if (!user || !synced) return;
    void updateAccountSettings(settings)
      .then(({ ok }) => setSynced(ok))
      .catch(() => setSynced(false));
    // Intentionally runs on hydration only; per-key updates handle later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced, user]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      // Reduced motion must never influence which theme is applied.
      document.documentElement.dataset.theme = resolveTheme(settings.theme, media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
  }, [settings.reducedMotion]);

  const value = useMemo(() => ({ settings, update, reset, synced }), [settings, update, reset, synced]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}

/** Convenient hook for the common theme-toggle case. */
export function useTheme() {
  const { settings, update } = useSettings();
  const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
  const resolved = resolveTheme(settings.theme, media);
  const toggle = () => update('theme', resolved === 'dark' ? 'light' : 'dark');
  return { preference: settings.theme, resolved, toggle, setTheme: (theme: CodeMentorSettings['theme']) => update('theme', theme) };
}
