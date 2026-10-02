import assert from 'node:assert/strict';
import test from 'node:test';
import { JUDGE0_LANGUAGE_ID, JUDGE0_SUPPORTED } from '../providers/judge0ExecutionProvider.js';
import { normalizeJudge0Run } from '../providers/judge0Normalizer.js';

/**
 * Pins the Judge0 CE normalizer. Judge0's raw submission payloads must map onto
 * CodeMentor's honest status model without ever inventing time, memory or an
 * error line, and the language map must cover every compiled language offered.
 */

test('normalizeJudge0Run maps an accepted run to success and converts units', () => {
  const result = normalizeJudge0Run(
    { status: { id: 3, description: 'Accepted' }, stdout: 'ok\n', stderr: '', time: '0.031', memory: 12804, exit_code: 0 },
    40,
  );
  assert.equal(result.status, 'success');
  assert.equal(result.stdout, 'ok\n');
  assert.equal(result.exitCode, 0);
  // Judge0 reports seconds -> milliseconds.
  assert.equal(result.time, 31);
  // Judge0 reports kilobytes -> bytes.
  assert.equal(result.memory, 12804 * 1024);
  assert.equal(result.errorLine, null);
  assert.equal(result.executionMode, 'secure_remote');
});

test('normalizeJudge0Run treats a wrong answer as success (no expected output in a learning runner)', () => {
  const result = normalizeJudge0Run({ status: { id: 4, description: 'Wrong Answer' }, stdout: 'value\n' }, 12);
  assert.equal(result.status, 'success');
  assert.equal(result.stdout, 'value\n');
});

test('normalizeJudge0Run maps a compile error and extracts a line-anchored location', () => {
  const result = normalizeJudge0Run(
    {
      status: { id: 6, description: 'Compilation Error' },
      compile_output: 'main.c:5:3: error: expected ";" before "}"\n',
      stdout: null,
    },
    15,
  );
  assert.equal(result.status, 'compilation_error');
  assert.equal(result.stdout, '');
  assert.match(result.compileOutput, /expected/);
  assert.equal(result.errorLine, 5);
  assert.equal(result.errorLineConfidence, 'estimated');
});

test('normalizeJudge0Run maps TLE and runtime signals honestly', () => {
  const tle = normalizeJudge0Run({ status: { id: 5, description: 'Time Limit Exceeded' } }, 3000);
  assert.equal(tle.status, 'time_limit_exceeded');
  assert.equal(tle.errorLine, null);

  const segv = normalizeJudge0Run(
    { status: { id: 7, description: 'Runtime Error (SIGSEGV)' }, stderr: 'Segmentation fault', stdout: 'partial\n' },
    22,
  );
  assert.equal(segv.status, 'runtime_error');
  assert.equal(segv.stderr, 'Segmentation fault');
  // stdout produced before the crash is kept — the learner needs it.
  assert.equal(segv.stdout, 'partial\n');
  assert.equal(segv.errorLine, null);
  assert.equal(segv.errorLineConfidence, 'unknown');
});

test('normalizeJudge0Run never invents detail for an unknown status', () => {
  const result = normalizeJudge0Run({ status: { id: 13, description: 'Internal Error' } }, 5);
  assert.equal(result.status, 'internal_error');
  assert.equal(result.errorLine, null);
  assert.equal(result.errorLineConfidence, 'unknown');
  assert.equal(result.memory, null);
});

test('every compiled language maps to a Judge0 language id', () => {
  for (const language of ['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin']) {
    assert.ok(JUDGE0_SUPPORTED.includes(language), `${language} should be supported`);
    assert.equal(typeof JUDGE0_LANGUAGE_ID[language], 'number');
  }
  assert.equal(JUDGE0_SUPPORTED.length, 9);
});
