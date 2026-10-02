import assert from 'node:assert/strict';
import test from 'node:test';
import { deepAnalyzeSchema, runSchema } from '../validators/requestSchemas.js';
import { TtlCache } from '../cache/ttlCache.js';
import { stableHash, stableStringify, truncate } from '../utils/hash.js';

/**
 * Pins the API validation contract (§15/§21) and the caching primitives the
 * AI fair-use and runtime-discovery services rely on (§19/§34/§38).
 */

test('runSchema accepts a valid secure run request with defaults', () => {
  const parsed = runSchema.safeParse({ language: 'c', source: 'int main(void){return 0;}' });
  assert.ok(parsed.success);
  assert.equal(parsed.success && parsed.data.stdin, '');
});

test('runSchema rejects unknown languages, oversized sources and bad stdin', () => {
  assert.ok(!runSchema.safeParse({ language: 'cobol', source: 'x' }).success);
  assert.ok(!runSchema.safeParse({ language: 'c', source: 'x'.repeat(51201) }).success);
  assert.ok(!runSchema.safeParse({ language: 'c', source: 'x', stdin: 'y'.repeat(10241) }).success);
  assert.ok(!runSchema.safeParse({ language: 'c', source: '' }).success);
});

test('deepAnalyzeSchema bounds the AI context and sections', () => {
  const ok = deepAnalyzeSchema.safeParse({
    language: 'Python',
    source: 'print(1)',
    sections: ['overview', 'errors'],
    explanationLevel: 'Beginner',
    hintLevel: 'Guided',
  });
  assert.ok(ok.success);
  assert.ok(!deepAnalyzeSchema.safeParse({ language: 'Python', source: ''.padEnd(12001, 'x') }).success);
  assert.ok(!deepAnalyzeSchema.safeParse({ language: 'Python', source: 'x', sections: ['bogus'] }).success);
});

test('TtlCache expires entries after their TTL', async () => {
  const cache = new TtlCache<string>();
  cache.set('fresh', 'value', 60_000);
  cache.set('stale', 'value', 1);
  assert.equal(cache.get('fresh'), 'value');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(cache.get('stale'), undefined);
  assert.equal(cache.get('missing'), undefined);
});

test('stableStringify is order-independent so cache keys are stable', () => {
  const a = stableStringify({ language: 'c', source: 'x', errors: [{ line: 3, type: 'NameError' }] });
  const b = stableStringify({ errors: [{ type: 'NameError', line: 3 }], source: 'x', language: 'c' });
  assert.equal(a, b);
  assert.equal(stableHash({ a: 1 }), stableHash({ a: 1 }));
  assert.notEqual(stableHash({ a: 1 }), stableHash({ a: 2 }));
});

test('truncate keeps AI excerpts inside the configured budget', () => {
  assert.equal(truncate('short', 10), 'short');
  const long = 'x'.repeat(12001);
  const cut = truncate(long, 12000);
  assert.ok(cut.startsWith('x'.repeat(100))); // content preserved up to the budget
  assert.ok(cut.length > 12000 && cut.length <= 12000 + 20); // budget plus marker
  assert.match(cut, /truncat(ed|ion)/);
});
