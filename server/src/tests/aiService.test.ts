import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callWithOutputRepair,
  fetchWithUnavailableRetry,
  geminiOpenAiEndpoint,
  isGeminiOpenAiCompatible,
  parseChatProviderResponse,
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

test('parseChatProviderResponse reads native Gemini and OpenAI-compatible text replies', () => {
  assert.equal(
    parseChatProviderResponse(
      { candidates: [{ content: { parts: [{ text: 'A Gemini chat reply.' }] } }] },
      true,
    ),
    'A Gemini chat reply.',
  );
  assert.equal(
    parseChatProviderResponse(
      { choices: [{ message: { content: 'An OpenAI-compatible chat reply.' } }] },
      false,
    ),
    'An OpenAI-compatible chat reply.',
  );
});

test('parseChatProviderResponse rejects empty or malformed replies', () => {
  assert.throws(() => parseChatProviderResponse({ choices: [] }, false), ProviderOutputError);
  assert.throws(
    () => parseChatProviderResponse({ choices: [{ message: { content: '   ' } }] }, false),
    ProviderOutputError,
  );
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

test('AI provider HTTP 503 is retried once and returns the recovered response', async () => {
  let calls = 0;
  const response = await fetchWithUnavailableRetry(
    async () => {
      calls += 1;
      return calls === 1
        ? new Response('temporarily unavailable', { status: 503 })
        : new Response('recovered', { status: 200 });
    },
    new AbortController().signal,
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'recovered');
  assert.equal(calls, 2);
});

test('persistent provider HTTP 503 is not retried indefinitely', async () => {
  let calls = 0;
  const response = await fetchWithUnavailableRetry(
    async () => {
      calls += 1;
      return new Response('temporarily unavailable', { status: 503 });
    },
    new AbortController().signal,
  );

  assert.equal(response.status, 503);
  assert.equal(calls, 2);
});

test('other provider HTTP statuses are not retried', async () => {
  let calls = 0;
  const response = await fetchWithUnavailableRetry(
    async () => {
      calls += 1;
      return new Response('rate limited', { status: 429 });
    },
    new AbortController().signal,
  );

  assert.equal(response.status, 429);
  assert.equal(calls, 1);
});

test('provider retry delay respects the request abort signal', async () => {
  const controller = new AbortController();
  let calls = 0;
  const retry = fetchWithUnavailableRetry(
    async () => {
      calls += 1;
      return new Response('temporarily unavailable', { status: 503 });
    },
    controller.signal,
  );
  setTimeout(() => controller.abort(), 20);

  await assert.rejects(retry, (error: unknown) => error instanceof Error && error.name === 'AbortError');
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
