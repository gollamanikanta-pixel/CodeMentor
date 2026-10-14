import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  availableLanguageNames,
  comingSoonLanguageNames,
  localRunnerLanguages,
  isInteractiveRunnable,
  languageOptionLabel,
  languageByDisplayName,
  multiFileExecutionLanguages,
  secureRemoteLanguages,
} from '../src/data/languages';
import { normalizeSettings } from '../src/settings/defaults';

test('Python and JavaScript use local browser runners', () => {
  assert.deepEqual(localRunnerLanguages, ['Python', 'JavaScript']);
  for (const language of localRunnerLanguages) {
    const config = languageByDisplayName[language];
    assert.equal(config.executionMode, language === 'Python' ? 'browser_python' : 'browser_javascript');
    assert.equal(config.executionEnabled, true, `${language} should be enabled`);
    assert.equal(isInteractiveRunnable(language), true);
  }
});

test('C, C++, and Java use the secure remote runner in the single-file Playground', () => {
  for (const language of secureRemoteLanguages) {
    const config = languageByDisplayName[language];
    assert.equal(config.executionMode, 'secure_remote');
    assert.equal(config.executionEnabled, false);
    assert.equal(isInteractiveRunnable(language), false);
    assert.match(config.statusDescription, /Source code and input are sent only after you choose Run Code/);
    assert.equal(config.providerLanguage, language === 'C++' ? 'cpp' : language.toLowerCase());
  }
});

test('only the six presentation languages are available and the rest are marked coming soon', () => {
  assert.deepEqual(availableLanguageNames, ['Python', 'JavaScript', 'Java', 'C', 'C++', 'HTML']);
  assert.deepEqual(comingSoonLanguageNames, ['TypeScript', 'SQL', 'C#', 'Go', 'PHP', 'Ruby', 'Rust', 'Kotlin']);
  assert.deepEqual(multiFileExecutionLanguages, ['C', 'C++', 'Java']);
  for (const language of comingSoonLanguageNames) {
    assert.equal(isInteractiveRunnable(language), false, `${language} should not be runnable yet`);
    assert.equal(languageOptionLabel(language), `${language} (Coming soon)`);
  }
  assert.equal(normalizeSettings({ defaultLanguage: 'Go' }).defaultLanguage, 'Python');
});

test('analysis-only and preview languages are not routed to the console runner', () => {
  for (const language of ['TypeScript', 'SQL', 'HTML'] as const) {
    assert.equal(isInteractiveRunnable(language), false);
  }
});
