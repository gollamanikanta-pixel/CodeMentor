import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedJson, readBoundedText, truncateUtf8 } from '../providers/providerResponse.js';

test('bounded provider reader parses a response within its byte budget', async () => {
  const response = new Response('{"stdout":"ok"}', {
    headers: { 'content-type': 'application/json', 'content-length': '14' },
  });

  assert.deepEqual(await readBoundedJson<{ stdout: string }>(response, 20), { stdout: 'ok' });
});

test('bounded provider reader rejects oversized declared and streamed bodies', async () => {
  const declared = new Response('12345', { headers: { 'content-length': '5' } });
  const streamed = new Response('12345');

  await assert.rejects(readBoundedText(declared, 4), /exceeded the 4-byte limit/);
  await assert.rejects(readBoundedText(streamed, 4), /exceeded the 4-byte limit/);
});

test('bounded JSON reader rejects malformed JSON', async () => {
  await assert.rejects(readBoundedJson(new Response('{'), 10), /invalid JSON/);
});

test('provider output is truncated on UTF-8 character boundaries within the byte budget', () => {
  const result = truncateUtf8('🙂'.repeat(50), 100);

  assert.ok(Buffer.byteLength(result, 'utf8') <= 100);
  assert.ok(result.endsWith('[Output truncated at 100 bytes by CodeMentor]'));
  assert.doesNotMatch(result, /\uFFFD/);
});
