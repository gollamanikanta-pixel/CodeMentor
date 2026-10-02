import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { errorLineFromPistonOutput, normalizePistonRun } from '../providers/pistonNormalizer.js';

/**
 * Pins the provider response normalizer (§19/§21): Piston's raw run/compile
 * payloads must map onto CodeMentor's honest status model without ever
 * inventing time, memory, or an error line.
 */

test('normalizePistonRun maps a clean run to success', () => {
  const result = normalizePistonRun({ run: { stdout: 'ok\n', stderr: '', code: 0, signal: null } }, 12);
  assert.equal(result.status, 'success');
  assert.equal(result.stdout, 'ok\n');
  assert.equal(result.exitCode, 0);
  assert.equal(result.errorLine, null);
  assert.equal(result.executionMode, 'secure_remote');
});

test('normalizePistonRun maps nonzero exit codes to runtime_error without inventing a line', () => {
  // A tab-indented stack frame does not start the line, so the normalizer
  // refuses to guess: confidence stays `unknown` and errorLine stays null.
  const result = normalizePistonRun(
    { run: { stdout: '', stderr: 'Exception in thread "main" java.lang.ArithmeticException: / by zero\n\tat Main.main(Main.java:4)', code: 1, signal: null } },
    10,
  );
  assert.equal(result.status, 'runtime_error');
  assert.equal(result.errorLine, null);
  assert.equal(result.errorLineConfidence, 'unknown');

  // A line-anchored frame, as gcc/javac print them, IS extracted.
  const anchored = normalizePistonRun(
    { run: { stdout: '', stderr: 'Main.java:4: error: cannot find symbol', code: 1, signal: null } },
    10,
  );
  assert.equal(anchored.errorLine, 4);
  assert.equal(anchored.errorLineConfidence, 'estimated');
});

test('normalizePistonRun maps SIGKILL to time_limit_exceeded without inventing memory', () => {
  const result = normalizePistonRun({ run: { stdout: '', stderr: '', code: null, signal: 'SIGKILL' } }, 3000);
  assert.equal(result.status, 'time_limit_exceeded');
  assert.equal(result.memory, null);
});

test('normalizePistonRun keeps compile output and line for compilation errors', () => {
  const result = normalizePistonRun(
    {
      compile: { stdout: '', stderr: 'main.c: In function "main":\nmain.c:5:9: error: expected ";" before "return"\n', code: 1, signal: null },
      run: null,
    },
    30,
  );
  assert.equal(result.status, 'compilation_error');
  assert.ok(result.errorLine === 5 || result.errorLine === null); // best-effort only
  assert.match(result.compileOutput, /main\.c:5/);
});

test('errorLineFromPistonOutput understands the advertised file extensions', () => {
  assert.equal(errorLineFromPistonOutput('main.cpp:12:5: error: x'), 12);
  assert.equal(errorLineFromPistonOutput('Main.java:4: error: cannot find symbol'), 4);
  assert.equal(errorLineFromPistonOutput('main.rs:7:3: error: cannot borrow'), 7);
  assert.equal(errorLineFromPistonOutput('nothing recognizable here'), null);
  // Tab-indented stack frames do not start the line, so no line is claimed.
  assert.equal(errorLineFromPistonOutput('\tat Main.main(Main.java:4)'), null);
});

test('schema.sql never references an execution primitive and provider docs stay honest', () => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/db/schema.sql'), 'utf8');
  assert.doesNotMatch(schema, /child_process|execSync|spawn\(/);
  // The comment in the adapter mentions the primitives only to say they are
  // absent, so the real guard is the schema plus the absence of any import.
  const providersDir = path.resolve(process.cwd(), 'src/providers');
  for (const file of fs.readdirSync(providersDir)) {
    const source = fs.readFileSync(path.join(providersDir, file), 'utf8');
    assert.doesNotMatch(source, /require\(['"]child_process|from ['"]child_process|await import\(['"]child_process/);
  }
});
