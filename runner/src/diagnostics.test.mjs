import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorLineFromOutput } from './diagnostics.mjs';

const diagnostics = [
  ['python', '  File "/tmp/codementor/main.py", line 3, in <module>', 3],
  ['javascript', '    at Object.<anonymous> (/tmp/codementor/main.js:4:7)', 4],
  ['c', 'main.c:5:10: error: expected expression', 5],
  ['cpp', 'main.cpp:6:12: error: expected primary-expression', 6],
  ['java', 'Main.java:7: error: cannot find symbol', 7],
  ['csharp', 'main.cs(8,13): error CS0103: name not found', 8],
  ['go', './main.go:9:2: undefined: missing', 9],
  ['php', 'PHP Fatal error: Uncaught Error in main.php on line 10', 10],
  ['ruby', '/tmp/main.rb:11:in `<main>\': undefined local variable', 11],
  ['rust', ' --> main.rs:12:5', 12],
  ['kotlin', 'at MainKt.main(Main.kt:13)', 13],
];

for (const [language, output, expectedLine] of diagnostics) {
  test(`${language} diagnostics identify the source line`, () => {
    assert.equal(errorLineFromOutput(language, output, 20), expectedLine);
  });
}

test('unknown, out-of-range, and unrelated locations do not become source markers', () => {
  assert.equal(errorLineFromOutput('python', 'File "library.py", line 2', 5), null);
  assert.equal(errorLineFromOutput('python', 'File "/tmp/main.py", line 8', 5), null);
  assert.equal(errorLineFromOutput('sql', 'main.py:2: issue', 5), null);
});

test('compiler line locations remain detectable when the terminal adds ANSI color', () => {
  assert.equal(
    errorLineFromOutput('c', '\u001b[01m\u001b[Kmain.c:\u001b[m\u001b[K3:3: \u001b[01;31merror\u001b[m', 5),
    3,
  );
});
