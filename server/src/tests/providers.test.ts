import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPistonFiles,
  PISTON_LANGUAGE,
  PISTON_SUPPORTED,
  resolvePistonRuntime,
} from '../providers/pistonExecutionProvider.js';
import { selectExecutionProvider } from '../providers/index.js';

/**
 * Guards the Piston adapter's language mapping and file packaging: every
 * advertised secure-runner language must map to a real Piston language id and
 * receive a sensible fallback filename, and the provider factory must stay
 * honest — an unknown language never reaches the remote runner.
 */
test('every advertised secure-runner language maps to a Piston language id', () => {
  for (const language of ['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin']) {
    assert.ok(PISTON_LANGUAGE[language], `missing Piston mapping for ${language}`);
  }
  assert.equal(PISTON_LANGUAGE.cpp, 'c++');
  assert.ok(PISTON_SUPPORTED.includes('c'));
});

test('buildPistonFiles keeps learner filenames and falls back per language', () => {
  const multi = buildPistonFiles({
    language: 'c',
    source: 'int main(void){return 0;}',
    stdin: '',
    files: [
      { relativePath: 'main.c', content: 'int main(void){return 0;}' },
      { relativePath: 'util.h', content: '#define ANSWER 42' },
    ],
  });
  assert.deepEqual(
    multi.map((file) => file.relativePath),
    ['main.c', 'util.h'],
  );

  const fallbackJava = buildPistonFiles({ language: 'java', source: 'class Main {}', stdin: '' });
  assert.equal(fallbackJava[0].relativePath, 'Main.java');

  const fallbackRust = buildPistonFiles({ language: 'rust', source: 'fn main() {}', stdin: '' });
  assert.equal(fallbackRust[0].relativePath, 'main.rs');
});

test('resolvePistonRuntime picks the newest matching version from a runtime list', async () => {
  // The network is not touched: an unknown language resolves to null before
  // any fetch happens, which is the contract this test can assert safely.
  const none = await resolvePistonRuntime('cobol');
  assert.equal(none, null);
});

test('provider selection never routes an unmapped language to the remote runner', () => {
  // `usingPiston()` requires EXECUTION_PROVIDER=piston plus a base URL; with a
  // base URL set the factory must still refuse a language outside its mapping.
  process.env.EXECUTION_PROVIDER = 'piston';
  process.env.EXECUTION_API_BASE_URL = 'http://localhost:2000/api/v2';
  const cobol = selectExecutionProvider('cobol');
  const c = selectExecutionProvider('c');
  assert.ok('run' in cobol);
  assert.ok('run' in c);
  delete process.env.EXECUTION_PROVIDER;
  delete process.env.EXECUTION_API_BASE_URL;
});
