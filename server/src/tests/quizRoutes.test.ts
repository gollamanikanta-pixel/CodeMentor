import assert from 'node:assert/strict';
import test from 'node:test';
import { quizCreateSchema } from '../routes/quizRoutes.js';

const quiz = {
  project: 'Local practice',
  language: 'Python',
  difficulty: 'Beginner',
  score: 3,
  total: 5,
  percentage: '60%',
  conceptsToReview: ['loops'],
};

test('quiz history accepts an optional original timestamp for local-history import', () => {
  const date = '2025-03-04T12:30:00.000Z';
  const parsed = quizCreateSchema.safeParse({ ...quiz, date });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.date, date);
});

test('quiz history rejects invalid imported timestamps', () => {
  assert.equal(quizCreateSchema.safeParse({ ...quiz, date: 'not-a-date' }).success, false);
});
