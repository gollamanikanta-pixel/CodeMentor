import type { LanguageName } from '../types';
import { isLanguageAvailable } from '../data/languages';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ExplanationLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type HintLevel = 'Gentle' | 'Guided' | 'Learning';

export type CodeMentorSettings = {
  theme: ThemePreference;
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  reducedMotion: boolean;
  explanationLevel: ExplanationLevel;
  hintLevel: HintLevel;
  defaultLanguage: LanguageName;
  automaticVisuals: boolean;
  automaticQuizReadiness: boolean;
  autosave: boolean;
  aiDeepHelp: boolean;
};

export const defaultSettings: CodeMentorSettings = {
  theme: 'dark',
  fontSize: 14,
  wordWrap: true,
  minimap: false,
  reducedMotion: false,
  explanationLevel: 'Beginner',
  hintLevel: 'Guided',
  defaultLanguage: 'Python',
  automaticVisuals: true,
  automaticQuizReadiness: true,
  autosave: true,
  aiDeepHelp: true,
};

/** Merge stored settings over defaults so new keys always have a value. */
export function normalizeSettings(value: unknown): CodeMentorSettings {
  if (!value || typeof value !== 'object') return { ...defaultSettings };
  const settings = { ...defaultSettings, ...(value as Partial<CodeMentorSettings>) };
  if (!isLanguageAvailable(settings.defaultLanguage)) settings.defaultLanguage = defaultSettings.defaultLanguage;
  return settings;
}
