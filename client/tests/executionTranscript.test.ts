import assert from 'node:assert/strict';
import test from 'node:test';
import { formatExecutionTranscript } from '../src/features/console/executionTranscript';

test('echoes stdin beside a visible input prompt before later output', () => {
  assert.equal(
    formatExecutionTranscript(
      'Enter a number: Sum is greater than 50\nFinal sum: 55',
      '10',
    ),
    'Enter a number: 10\nSum is greater than 50\nFinal sum: 55',
  );
});

test('places input on the line after a newline-terminated prompt', () => {
  assert.equal(
    formatExecutionTranscript('Enter a number:\nSum is greater than 50\nFinal sum: 55', '10'),
    'Enter a number:\n10\nSum is greater than 50\nFinal sum: 55',
  );
});

test('shows supplied stdin before output when the program has no visible prompt', () => {
  assert.equal(formatExecutionTranscript('Sum is greater than 50\nFinal sum: 55', '10'), '10\nSum is greater than 50\nFinal sum: 55');
});

test('keeps multiple supplied values together after a visible prompt', () => {
  assert.equal(formatExecutionTranscript('Enter numbers: Sum is 30', '10\n20'), 'Enter numbers: 10\n20\nSum is 30');
});

test('does not echo stdin twice for local runners', () => {
  assert.equal(formatExecutionTranscript('Enter a number: 10\nSum is 10', '10', true), 'Enter a number: 10\nSum is 10');
});

test('preserves output unchanged when there is no input', () => {
  assert.equal(formatExecutionTranscript('Hello\nWorld', ''), 'Hello\nWorld');
});

test('does not hide a runtime message when the program printed nothing', () => {
  assert.equal(formatExecutionTranscript('', '10'), '');
});
