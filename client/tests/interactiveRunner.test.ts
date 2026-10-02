import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  availableLanguageNames,
  comingSoonLanguageNames,
  interactiveRunnerLanguages,
  isInteractiveRunnable,
  languageOptionLabel,
  languageByDisplayName,
  multiFileExecutionLanguages,
} from '../src/data/languages';
import { normalizeSettings } from '../src/settings/defaults';

test('every advertised executable console language uses the hosted interactive runner', () => {
  assert.deepEqual(interactiveRunnerLanguages, ['Python', 'JavaScript', 'C', 'C++', 'Java']);
  for (const language of interactiveRunnerLanguages) {
    const config = languageByDisplayName[language];
    assert.equal(config.executionMode, 'interactive_hosted', `${language} should use the interactive runner`);
    assert.equal(config.executionEnabled, true, `${language} should be enabled`);
    assert.equal(isInteractiveRunnable(language), true);
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
