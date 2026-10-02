import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocally } from '../src/analyzers/localAnalyzer';
import type { ExecutionResult } from '../src/types';

const execution = (overrides: Partial<ExecutionResult>): ExecutionResult => ({
  status: 'success',
  stdout: '',
  stderr: '',
  message: '',
  time: 1,
  errorLine: null,
  errorLineConfidence: 'unknown',
  executionMode: 'browser_python',
  ...overrides,
});

test('Python analyzer flags a literal division by zero', () => {
  const analysis = analyzeLocally('total = 10\nprint(total / 0)', 'Python', null);
  assert.ok(analysis.errors.some((error) => error.type === 'ZeroDivisionError'));
  assert.equal(analysis.source, 'local');
});

test('Python analyzer flags an unmatched bracket', () => {
  const analysis = analyzeLocally('print((1 + 2)', 'Python', null);
  assert.ok(analysis.errors.some((error) => error.type === 'UnbalancedBrackets'));
});

test('Python analyzer maps a runtime traceback to a learning error', () => {
  const analysis = analyzeLocally(
    'print(missing)',
    'Python',
    execution({ status: 'runtime_error', stderr: 'NameError: name missing is not defined', errorLine: 1, errorLineConfidence: 'exact' }),
  );
  const error = analysis.errors.find((item) => item.type === 'NameError');
  assert.ok(error);
  assert.equal(error?.severity, 'error');
  assert.equal(error?.line, 1);
});

test('Python analyzer summarizes a noisy traceback to the final exception line', () => {
  const noisy = [
    'Traceback (most recent call last):',
    '  File "/lib/python312.zip/_pyodide/_base.py", line 596, in eval_code_async',
    '    await CodeRunner(',
    '  File "<exec>", line 1, in <module>',
    "NameError: name 'missing' is not defined",
  ].join('\n');
  const analysis = analyzeLocally(
    'print(missing)',
    'Python',
    execution({ status: 'runtime_error', stderr: noisy, errorLine: 1, errorLineConfidence: 'exact' }),
  );
  const error = analysis.errors.find((item) => item.type === 'NameError');
  assert.equal(error?.technicalMessage, "NameError: name 'missing' is not defined");
  assert.equal(error?.technicalMessage.includes('_base.py'), false);
});

test('JavaScript analyzer hints at loose equality without blocking', () => {
  const analysis = analyzeLocally('if (a == "1") { console.log(a); }', 'JavaScript', null);
  const hint = analysis.errors.find((item) => item.type === 'LooseEquality');
  assert.ok(hint);
  assert.equal(hint?.severity, 'hint');
});

test('TypeScript analyzer reports the any annotation as a hint', () => {
  const analysis = analyzeLocally('const value: any = 1;', 'TypeScript', null);
  const hint = analysis.errors.find((item) => item.type === 'AnyType');
  assert.ok(hint);
  assert.equal(hint?.severity, 'hint');
});

test('SQL analyzer flags a SELECT without FROM', () => {
  const analysis = analyzeLocally('SELECT name;', 'SQL', null);
  assert.ok(analysis.errors.some((error) => error.type === 'MissingFrom'));
});

test('SQL analyzer warns when DELETE has no filter', () => {
  const analysis = analyzeLocally('DELETE FROM students;', 'SQL', null);
  assert.ok(analysis.errors.some((error) => error.type === 'UnfilteredWrite'));
});

test('analyzer never returns corrected code fields', () => {
  const analysis = analyzeLocally('print(missing)', 'Python', null);
  const serialized = JSON.stringify(analysis);
  for (const forbidden of ['correctedCode', 'fixedCode', 'correctedLine', 'applyFix', 'patch', 'replacement']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('diagram selection prefers loop and function structure', () => {
  assert.equal(analyzeLocally('for i in range(3):\n  print(i)', 'Python', null).diagram.kind, 'loop');
  assert.equal(analyzeLocally('def add(a, b):\n  return a + b', 'Python', null).diagram.kind, 'function');
});

test('a function called from elsewhere is not mistaken for recursion', () => {
  const starter = [
    'def average(scores):',
    '    total = sum(scores)',
    '    return total / len(scores)',
    '',
    'marks = [82, 91, 76, 88]',
    'print("Class average:", average(marks))',
  ].join('\n');
  const analysis = analyzeLocally(starter, 'Python', null);
  assert.equal(analysis.concepts.includes('Recursion'), false);
  assert.equal(analysis.diagram.kind, 'function');
});

test('recursion is detected for Python, named and arrow functions', () => {
  const python = ['def factorial(n):', '    if n <= 1:', '        return 1', '    return n * factorial(n - 1)'].join('\n');
  const named = 'function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}';
  const arrow = 'const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));';
  for (const [source, language] of [
    [python, 'Python'],
    [named, 'JavaScript'],
    [arrow, 'JavaScript'],
  ] as const) {
    const analysis = analyzeLocally(source, language, null);
    assert.equal(analysis.concepts.includes('Recursion'), true, `${language} recursion missed`);
    assert.equal(analysis.diagram.kind, 'recursion');
  }
});

test('stack and queue usage select the matching diagram', () => {
  const stack = ['history = []', 'for page in visits:', '    history.append(page)', 'print(history.pop())'].join('\n');
  const queue = 'from collections import deque\nwaiting = deque()\nprint(waiting.popleft())';
  assert.equal(analyzeLocally(stack, 'Python', null).diagram.kind, 'stack');
  assert.equal(analyzeLocally(queue, 'Python', null).diagram.kind, 'queue');
});

test('all nine diagram kinds are reachable and each explains itself in words', () => {
  const samples: Array<[string, string]> = [
    ['marks = [1, 2]\nprint(marks[0])', 'Python'],
    ['history = []\nhistory.append(1)\nhistory.pop()', 'Python'],
    ['from collections import deque\nq = deque()\nq.popleft()', 'Python'],
    ['student = {"a": 1}', 'Python'],
    ['def add(a, b):\n  return a + b', 'Python'],
    ['def f(n):\n  return f(n - 1)', 'Python'],
    ['if a > 1:\n  print(a)', 'Python'],
    ['for i in range(3):\n  print(i)', 'Python'],
    ['print("hello")', 'Python'],
  ];

  const kinds = new Set<string>();
  for (const [source, language] of samples) {
    const analysis = analyzeLocally(source, language as never, null);
    assert.notEqual(analysis.diagram.caption, 'Generated locally from detected code structure.');
    assert.ok(analysis.diagram.caption.length > 40, `caption too short for ${analysis.diagram.kind}`);
    kinds.add(analysis.diagram.kind);
  }

  assert.equal(kinds.size, 9, `expected all 9 diagram kinds, saw ${[...kinds].sort().join(', ')}`);
});
