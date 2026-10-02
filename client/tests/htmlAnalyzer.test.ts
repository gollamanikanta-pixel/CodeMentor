import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocally, analyzerSupports } from '../src/analyzers/localAnalyzer';

const PAGE = `<!doctype html>
<html lang="en">
  <head><title>Test</title></head>
  <body>
    <main>
      <img src="photo.png" />
      <p id="note">Hello</p>
      <p id="note">Again</p>
      <input type="text" />
      <script src="https://example.com/app.js"></script>
    </main>
  </body>
</html>`;

test('the analyzer advertises HTML support', () => {
  assert.equal(analyzerSupports('HTML'), true);
});

test('HTML analyzer flags an image without alternative text', () => {
  const analysis = analyzeLocally(PAGE, 'HTML');
  assert.ok(analysis.errors.some((error) => error.type === 'missing-alt'));
});

test('HTML analyzer flags a duplicate id', () => {
  const analysis = analyzeLocally(PAGE, 'HTML');
  const duplicate = analysis.errors.find((error) => error.type === 'duplicate-id');
  assert.ok(duplicate);
  assert.match(duplicate!.technicalMessage, /note/);
});

test('HTML analyzer suggests a label for an unlabelled form control', () => {
  const analysis = analyzeLocally(PAGE, 'HTML');
  assert.ok(analysis.errors.some((error) => error.type === 'unlabelled-input'));
});

test('HTML analyzer flags a blocked external resource', () => {
  const analysis = analyzeLocally(PAGE, 'HTML');
  assert.ok(analysis.errors.some((error) => error.type === 'external-resource'));
});

test('HTML analyzer owns up to a missing document skeleton', () => {
  const analysis = analyzeLocally('<div><p>Bare fragment</p></div>', 'HTML');
  assert.equal(analysis.errors.length, 0);
  assert.ok(analysis.warnings.length > 0);
});

test('a clean HTML page produces no structural errors', () => {
  const clean = `<!doctype html>
<html lang="en">
  <head><title>Clean</title></head>
  <body>
    <main>
      <img src="photo.png" alt="A learner working at a desk" />
      <form><label for="name">Name</label><input id="name" type="text" /></form>
    </main>
  </body>
</html>`;
  const analysis = analyzeLocally(clean, 'HTML');
  assert.deepEqual(analysis.errors, []);
});

test('HTML analysis never returns corrected code fields', () => {
  const analysis = analyzeLocally(PAGE, 'HTML') as unknown as Record<string, unknown>;
  for (const forbidden of ['correctedCode', 'fixedCode', 'correctedLine', 'applyFix', 'patch', 'replacement']) {
    assert.equal(forbidden in analysis, false, `unexpected field ${forbidden}`);
  }
});

test('every HTML learning error carries a full teaching shape', () => {
  const analysis = analyzeLocally(PAGE, 'HTML');
  assert.ok(analysis.errors.length > 0);
  for (const error of analysis.errors) {
    for (const field of [
      'title',
      'technicalMessage',
      'whatHappened',
      'whyItHappened',
      'gentleHint',
      'guidedHint',
      'learningHint',
      'conceptReminder',
      'selfCheckQuestion',
    ] as const) {
      assert.ok(typeof error[field] === 'string' && error[field].length > 0, `${error.type} is missing ${field}`);
    }
  }
});
