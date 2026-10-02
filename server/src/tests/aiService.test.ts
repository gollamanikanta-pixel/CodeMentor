import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProviderResponse, shapeResponse } from '../services/aiService.js';

const validGuidance = {
  summary: 'This function calculates an average.',
  deeperExplanation: 'It divides a total by the number of scores.',
  concepts: ['mean'],
  errors: [],
  debuggingSteps: ['Check for an empty list.'],
  tips: ['Try a different set of scores.'],
  additionalQuizQuestions: [],
  warnings: [],
};

test('shapeResponse requires the explanation shown by the UI', () => {
  assert.throws(() => shapeResponse({}), /provider-shape/);
  assert.throws(
    () => shapeResponse({ summary: 'A summary', deeperExplanation: '   ' }),
    /provider-shape/,
  );
});

test('shapeResponse returns bounded, typed guidance fields', () => {
  const response = shapeResponse({
    summary: '  The function calculates an average.  ',
    deeperExplanation: 'It divides the total by the number of scores.',
    concepts: ['mean', '', 12, ...Array.from({ length: 6 }, (_, index) => `concept ${index}`)],
    errors: [{ title: 'Supported object' }, null, 'not an object'],
    debuggingSteps: ['Check the list length.'],
    tips: ['Try another list.'],
    additionalQuizQuestions: [{ prompt: 'What is the mean?' }, null],
    warnings: ['No issue inferred.'],
  });

  assert.equal(response.summary, 'The function calculates an average.');
  assert.equal(response.deeperExplanation, 'It divides the total by the number of scores.');
  assert.deepEqual(response.concepts, ['mean', 'concept 0', 'concept 1', 'concept 2', 'concept 3']);
  assert.deepEqual(response.errors, [{ title: 'Supported object' }]);
  assert.deepEqual(response.debuggingSteps, ['Check the list length.']);
  assert.deepEqual(response.tips, ['Try another list.']);
  assert.deepEqual(response.additionalQuizQuestions, [{ prompt: 'What is the mean?' }]);
  assert.deepEqual(response.warnings, ['No issue inferred.']);
});

test('parseProviderResponse reads native Gemini JSON responses', () => {
  const response = parseProviderResponse(
    { candidates: [{ content: { parts: [{ text: JSON.stringify(validGuidance) }] } }] },
    true,
  );
  assert.equal(response.summary, validGuidance.summary);
  assert.equal(response.deeperExplanation, validGuidance.deeperExplanation);
});

test('parseProviderResponse reads OpenAI-compatible JSON responses', () => {
  const response = parseProviderResponse(
    { choices: [{ message: { content: JSON.stringify(validGuidance) } }] },
    false,
  );
  assert.equal(response.summary, validGuidance.summary);
  assert.equal(response.deeperExplanation, validGuidance.deeperExplanation);
});
