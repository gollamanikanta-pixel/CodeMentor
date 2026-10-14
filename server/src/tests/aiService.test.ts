import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callWithOutputRepair,
  geminiOpenAiEndpoint,
  isGeminiOpenAiCompatible,
  parseProviderResponse,
  providerFailureMessage,
  ProviderOutputError,
  ProviderRequestError,
  shapeResponse,
} from '../services/aiService.js';
import { accountAllowsAiDeepHelp } from '../services/aiPreferences.js';

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

test('Gemini OpenAI-compatible URLs use the chat completions endpoint', () => {
  const baseUrl = new URL('https://generativelanguage.googleapis.com/v1beta/openai/');

  assert.equal(isGeminiOpenAiCompatible(baseUrl), true);
  assert.equal(
    geminiOpenAiEndpoint(baseUrl),
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  );
  assert.equal(
    isGeminiOpenAiCompatible(new URL('https://generativelanguage.googleapis.com')),
    false,
  );
});

test('provider request failures are not retried as JSON repairs', async () => {
  let calls = 0;
  const error = new ProviderRequestError('http', 429);

  await assert.rejects(
    callWithOutputRepair(
      'context',
      async () => {
        calls += 1;
        throw error;
      },
      1000,
    ),
    (caught) => caught === error,
  );
  assert.equal(calls, 1);
});

test('provider access failures tell the learner what to check without exposing credentials', () => {
  const message = providerFailureMessage(new ProviderRequestError('http', 403));

  assert.match(message, /denied access \(HTTP 403\)/);
  assert.match(message, /API key, model access, and provider-side key restrictions/);
  assert.doesNotMatch(message, /token|secret|authorization/i);
});

test('provider request failures distinguish invalid model and endpoint configuration', () => {
  const message = providerFailureMessage(new ProviderRequestError('http', 404));

  assert.match(message, /configured model or endpoint \(HTTP 404\)/);
  assert.match(message, /AI_MODEL and AI_API_BASE_URL/);
});

test('malformed provider output gets at most one repair attempt', async () => {
  const calls: Array<{ repair: boolean; timeoutMs: number }> = [];
  const response = await callWithOutputRepair(
    'context',
    async (_content, repair, timeoutMs) => {
      calls.push({ repair, timeoutMs });
      if (!repair) throw new ProviderOutputError();
      return validGuidance;
    },
    1000,
  );

  assert.deepEqual(response, validGuidance);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.repair, false);
  assert.equal(calls[1]?.repair, true);
  assert.ok(calls[1]!.timeoutMs <= 1000);
});

test('account AI preference defaults on and can disable Deep Help server-side', () => {
  assert.equal(accountAllowsAiDeepHelp(undefined), true);
  assert.equal(accountAllowsAiDeepHelp(null), true);
  assert.equal(accountAllowsAiDeepHelp(1), true);
  assert.equal(accountAllowsAiDeepHelp(true), true);
  assert.equal(accountAllowsAiDeepHelp(0), false);
  assert.equal(accountAllowsAiDeepHelp('0'), false);
  assert.equal(accountAllowsAiDeepHelp(false), false);
});
