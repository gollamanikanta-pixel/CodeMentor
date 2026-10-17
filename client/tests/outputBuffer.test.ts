import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BoundedOutputBuffer,
  boundOutputText,
  MAX_RUN_OUTPUT_CHARS,
} from '../src/workers/outputBuffer';

test('bounded output preserves lines until the configured limit', () => {
  const output = new BoundedOutputBuffer(9);
  output.write('one');
  output.write('two');
  output.write('three');

  assert.equal(output.toString(), 'one\ntwo\nt\n... output stopped here to keep the lesson readable.');
});

test('bounded output truncates one oversized line and ignores later writes', () => {
  const output = new BoundedOutputBuffer(4);
  output.write('123456');
  output.write('ignored');

  assert.equal(output.toString(), '1234\n... output stopped here to keep the lesson readable.');
});

test('the browser runner default is bounded at 20,000 characters', () => {
  const output = new BoundedOutputBuffer();
  output.write('x'.repeat(MAX_RUN_OUTPUT_CHARS + 100));

  assert.equal(
    output.toString(),
    `${'x'.repeat(MAX_RUN_OUTPUT_CHARS)}\n... output stopped here to keep the lesson readable.`,
  );
});

test('empty output lines remain empty lines', () => {
  const output = new BoundedOutputBuffer(2);
  output.write('');
  output.write('');
  output.write('');
  output.write('');

  assert.equal(output.toString(), '\n\n\n... output stopped here to keep the lesson readable.');
});

test('provider error text is bounded before it is returned to the browser', () => {
  const result = boundOutputText('trace'.repeat(MAX_RUN_OUTPUT_CHARS));

  assert.ok(result.length < MAX_RUN_OUTPUT_CHARS + 100);
  assert.ok(result.endsWith('... output stopped here to keep the lesson readable.'));
});
