import assert from 'node:assert/strict';
import test from 'node:test';
import { extractVisualDetails } from '../src/analyzers/visualDetails';
import { analyzeLocally, analyzerSupports } from '../src/analyzers/localAnalyzer';

/**
 * Guards for program-specific visuals: two different programs must produce
 * different diagram labels, and every language must receive at least honest
 * structural analysis instead of a silent no-op.
 */

test('loop labels come from the actual source, per language', () => {
  const python = extractVisualDetails('for score in scores:\n    print(score)');
  assert.equal(python.loopLabel, 'score');

  const javascript = extractVisualDetails('for (const mark of marks) {\n  console.log(mark);\n}');
  assert.equal(javascript.loopLabel, 'mark');

  const c = extractVisualDetails('for (int i = 0; i < n; i++) {\n  printf("%d", i);\n}');
  assert.equal(c.loopLabel, 'i');
});

test('different programs produce different diagram details', () => {
  const scores = analyzeLocally('scores = [82, 91, 76]\nfor s in scores:\n    print(s)', 'Python');
  const names = analyzeLocally('names = ["ada", "lin"]\nfor name in names:\n    print(name)', 'Python');
  assert.equal(scores.diagram.kind, 'loop');
  assert.equal(names.diagram.kind, 'loop');
  assert.notEqual(scores.diagram.details.loopLabel, names.diagram.details.loopLabel);
  assert.match(JSON.stringify(scores.diagram.details), /s/);
  assert.match(JSON.stringify(names.diagram.details), /name/);
});

test('function diagrams name the real function', () => {
  const analysis = analyzeLocally('def average(values):\n    return sum(values) / len(values)\n\nprint(average([1, 2]))', 'Python');
  assert.equal(analysis.diagram.kind, 'function');
  assert.equal(analysis.diagram.details.functionLabel, 'average');
});

test('structural analysis covers every compiled language', () => {
  for (const language of ['C', 'C++', 'Java', 'C#', 'Go', 'PHP', 'Ruby', 'Rust', 'Kotlin']) {
    assert.equal(analyzerSupports(language), true, `${language} should be analyzable`);
    const analysis = analyzeLocally('int main(void) { return 0; }', language as never);
    assert.equal(analysis.source, 'local');
    assert.equal(analysis.language, language);
    assert.ok(analysis.summary.length > 0);
    assert.ok(analysis.diagram.details, 'diagram details present');
  }
});

test('C analyze surfaces a compile error as a learning error without any fix', () => {
  const analysis = analyzeLocally(
    '#include <stdio.h>\nint main(void){int x = ;return 0;}',
    'C',
    {
      status: 'compilation_error',
      stderr: '',
      message: 'error: expected expression before \';\' token',
      errorLine: 2,
      errorLineConfidence: 'estimated',
    } as never,
  );
  assert.equal(analysis.errors.length, 1);
  assert.equal(analysis.errors[0].line, 2);
  assert.equal(analysis.errors[0].category, 'Compile Error');
  const rendered = JSON.stringify(analysis);
  assert.doesNotMatch(rendered, /int main\(void\)\{int x = [^;]|apply fix|patch/i);
});

test('unbalanced braces raise a warning, not a correction', () => {
  const analysis = analyzeStructurallyForTest('int main(void) {\n  return 0;\n');
  assert.ok(analysis.warnings.some((warning) => /brace/i.test(warning)));
});

import { analyzeStructurally } from '../src/analyzers/structuralAnalyzer';
function analyzeStructurallyForTest(source: string) {
  return analyzeStructurally(source, 'C', null);
}
