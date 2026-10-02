import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocally } from '../src/analyzers/localAnalyzer';
import { generateLocalQuestions } from '../src/quizzes/localQuiz';

const analysis = analyzeLocally(
  'def average(scores):\n  return sum(scores) / len(scores)\n\nprint(average([1, 2]))',
  'Python',
  null,
);

test('quiz generation honours the requested question count', () => {
  const questions = generateLocalQuestions({ language: 'Python', analysis, difficulty: 'Beginner', count: 5 });
  assert.ok(questions.length > 0);
  assert.ok(questions.length <= 5);
});

test('every question has a valid single correct answer', () => {
  const questions = generateLocalQuestions({ language: 'Python', analysis, difficulty: 'Intermediate', count: 15 });
  for (const question of questions) {
    assert.ok(question.options.length >= 2);
    assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
    assert.ok(question.explanation.length > 0);
  }
});

test('quiz questions never reveal corrected code', () => {
  const questions = generateLocalQuestions({ language: 'Python', analysis, difficulty: 'Beginner', count: 10 });
  const serialized = JSON.stringify(questions);
  for (const forbidden of ['correctedCode', 'fixedCode', 'correctedLine', 'applyFix']) {
    assert.equal(serialized.includes(forbidden), false);
  }
  // Whole-word checks only, so ordinary words like "different" are not flagged.
  for (const word of ['patch', 'diff', 'replacement']) {
    assert.equal(new RegExp(`\\b${word}\\b`, 'i').test(serialized), false);
  }
});

test('generation still works without prior analysis', () => {
  const questions = generateLocalQuestions({ language: 'JavaScript', analysis: null, difficulty: 'Beginner', count: 5 });
  assert.ok(questions.length > 0);
});
