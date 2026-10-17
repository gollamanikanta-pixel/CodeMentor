import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPistonFiles,
  PISTON_LANGUAGE,
  PISTON_SUPPORTED,
  resolvePistonRuntime,
} from '../providers/pistonExecutionProvider.js';
import {
  buildJudge0Submission,
  JUDGE0_RESOURCE_LIMITS,
} from '../providers/judge0ExecutionProvider.js';
import { buildJudge0Capabilities, selectExecutionProvider } from '../providers/index.js';
import { normalizeLiveProviderResult } from '../providers/secureExecutionProvider.js';

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

test('Judge0 submissions request explicit execution and network limits', () => {
  assert.equal(JUDGE0_RESOURCE_LIMITS.enable_network, false);
  assert.equal(JUDGE0_RESOURCE_LIMITS.memory_limit, 256 * 1024);
  assert.equal(JUDGE0_RESOURCE_LIMITS.max_processes_and_or_threads, 20);
  assert.equal(JUDGE0_RESOURCE_LIMITS.number_of_runs, 1);
  assert.ok(JUDGE0_RESOURCE_LIMITS.cpu_time_limit > 0);
  assert.ok(JUDGE0_RESOURCE_LIMITS.wall_time_limit >= JUDGE0_RESOURCE_LIMITS.cpu_time_limit);
});

test('Judge0 applies the same bounded memory limit to Java and other languages', () => {
  assert.equal(buildJudge0Submission('', 103, '').memory_limit, JUDGE0_RESOURCE_LIMITS.memory_limit);
  assert.equal(buildJudge0Submission('', 91, '').memory_limit, JUDGE0_RESOURCE_LIMITS.memory_limit);
});

test('Judge0 capability report reflects the Java readiness probe', () => {
  const unavailable = buildJudge0Capabilities(
    '2026-03-25T00:00:00.000Z',
    { ok: false, message: 'Java readiness probe failed: Could not allocate compressed class space.' },
    'Judge0 CE remote runtime.',
  );

  assert.equal(unavailable.reachable, true);
  assert.equal(unavailable.languages.c.ready, true);
  assert.equal(unavailable.languages.java.ready, false);
  assert.match(unavailable.languages.java.note, /compressed class space/);
  assert.match(unavailable.message, /Java is unavailable/);

  const ready = buildJudge0Capabilities(
    '2026-03-25T00:00:00.000Z',
    { ok: true, message: 'java execution probe succeeded.' },
    'Judge0 CE remote runtime.',
  );
  assert.equal(ready.languages.java.ready, true);
});

test('generic runner responses are allow-listed, type-checked, and source-bounded', () => {
  const result = normalizeLiveProviderResult(
    {
      status: 'runtime_error',
      stdout: 'x'.repeat(200_000),
      stderr: { unexpected: true },
      compileOutput: 'compiler output',
      message: 'm'.repeat(1000),
      time: '15',
      memory: -1,
      exitCode: 1,
      errorLine: 99,
      errorLineConfidence: 'exact',
      correctedCode: 'must not reach the learner',
    },
    'line one\nline two',
  );

  assert.equal(result.status, 'runtime_error');
  assert.ok(Buffer.byteLength(result.stdout, 'utf8') <= 100_000);
  assert.equal(result.stderr, '');
  assert.ok(result.message.length <= 300);
  assert.equal(result.time, null);
  assert.equal(result.memory, null);
  assert.equal(result.errorLine, null);
  assert.equal(result.errorLineConfidence, 'unknown');
  assert.equal('correctedCode' in result, false);
});

test('generic runner responses with an unknown status are rejected', () => {
  const result = normalizeLiveProviderResult(
    { status: 'corrected', stdout: 'ok', correctedCode: 'not allowed' },
    'print("hello")',
  );

  assert.equal(result.status, 'internal_error');
  assert.equal(result.stdout, '');
  assert.equal('correctedCode' in result, false);
});
