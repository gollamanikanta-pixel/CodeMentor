import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const runnerSource = fs.readFileSync(path.resolve(process.cwd(), 'src/runners/browserRunner.ts'), 'utf8');
const sandboxPage = fs.readFileSync(path.resolve(process.cwd(), 'public/javascript-runner.html'), 'utf8');

test('JavaScript runner uses a sandboxed opaque-origin frame, dedicated worker and private port', () => {
  assert.match(runnerSource, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(runnerSource, /allow-same-origin/);
  assert.match(runnerSource, /new MessageChannel\(\)/);
  assert.match(runnerSource, /channel\.port2/);
  assert.match(runnerSource, /replyPort\?\.close\(\)/);
  assert.match(sandboxPage, /new Worker\(workerUrl\)/);
});

test('JavaScript sandbox denies network and external resources', () => {
  assert.match(sandboxPage, /default-src 'none'/);
  assert.match(sandboxPage, /connect-src 'none'/);
  assert.match(sandboxPage, /worker-src blob:/);
  assert.match(sandboxPage, /img-src 'none'/);
  assert.match(sandboxPage, /frame-src 'none'/);
  assert.match(sandboxPage, /form-action 'none'/);
});

test('learner source is received as data, not interpolated into the sandbox document', () => {
  assert.match(runnerSource, /postMessage\(\{ type: 'run', \.\.\.pendingRequest \}/);
  assert.match(sandboxPage, /new Function\('console', 'input', PRELUDE \+ '\\n' \+ sourceCode/);
  assert.doesNotMatch(runnerSource, /srcdoc\s*=/);
});
