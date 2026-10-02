import test from 'node:test';
import assert from 'node:assert/strict';
import { stableHash, stableStringify, truncate } from './hash.js';

test('stableStringify ignores object key order', () => {
  const a = { b: 1, a: { d: 2, c: 3 } };
  const b = { a: { c: 3, d: 2 }, b: 1 };
  assert.equal(stableStringify(a), stableStringify(b));
});

test('stableHash is deterministic for equivalent contexts', () => {
  assert.equal(
    stableHash({ language: 'Python', errors: [{ type: 'NameError', line: 3 }] }),
    stableHash({ errors: [{ line: 3, type: 'NameError' }], language: 'Python' }),
  );
});

test('stableHash differs when the source fragment differs', () => {
  assert.notEqual(stableHash({ source: 'x = 1' }), stableHash({ source: 'x = 2' }));
});

test('truncate keeps short values intact and marks long ones', () => {
  assert.equal(truncate('hello', 10), 'hello');
  assert.match(truncate('abcdefghij', 4), /^abcd/);
  assert.match(truncate('abcdefghij', 4), /truncated/);
});
