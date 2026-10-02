import { aiConfigured, env } from '../config/env.js';
import { TtlCache } from '../cache/ttlCache.js';
import { stableHash, truncate } from '../utils/hash.js';
import type { AiUsageSnapshot, DeepAnalyzeInput } from '../types/index.js';

const cache = new TtlCache<Record<string, unknown>>();
const usage = { day: new Date().toISOString().slice(0, 10), count: 0, lastRequestAt: 0 };

const SYSTEM_PROMPT =
  'You are CodeMentor Deep Help, a patient programming teacher. Local analysis is already available. Give deeper educational guidance only. Never give corrected code, exact corrected lines, patches, diffs, replacements, copy-paste solutions, or exact missing text for a learner’s specific line. Explain what happened, why, concepts, area to inspect, progressive hints, self-check questions, debugging steps, and concise tips. If uncertain, say possible issue or likely logic issue. Do not invent output or behavior. Return exactly one JSON object with these keys: summary (non-empty string), deeperExplanation (non-empty string), concepts (array of strings), errors (array of objects), debuggingSteps (array of strings), tips (array of strings), additionalQuizQuestions (array of objects), warnings (array of strings). Use empty arrays when there are no items. Do not wrap the JSON in markdown.';

function resetDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) {
    usage.day = today;
    usage.count = 0;
    usage.lastRequestAt = 0;
  }
}

/** Collapse a focused excerpt plus the local signals into a stable cache key. */
function buildCacheKey(input: DeepAnalyzeInput): string {
  const errors = Array.isArray(input.localAnalysis?.errors)
    ? (input.localAnalysis?.errors as Array<Record<string, unknown>>)
    : [];
  return stableHash({
    language: input.language,
    source: truncate(input.source, env.aiMaxSourceChars),
    executionFingerprint: input.execution
      ? { status: input.execution.status, errorLine: input.execution.errorLine }
      : null,
    errorFingerprints: errors.map((error) => ({ type: error.type, line: error.line, severity: error.severity })),
    explanationLevel: input.explanationLevel ?? 'Beginner',
    hintLevel: input.hintLevel ?? 'Guided',
    sections: input.sections ?? ['overview', 'line-by-line', 'errors', 'tips'],
    model: env.aiModel,
  });
}

/** Keep only the relevant excerpt and nearby lines so one request stays cheap. */
function buildUserContext(input: DeepAnalyzeInput): string {
  const source = truncate(input.source, env.aiMaxSourceChars);
  const lines = source.split(/\r?\n/);
  const excerpt = lines.slice(0, env.aiMaxContextLines).join('\n');
  return JSON.stringify({
    language: input.language,
    explanationLevel: input.explanationLevel ?? 'Beginner',
    hintLevel: input.hintLevel ?? 'Guided',
    requestedSections: input.sections ?? ['overview', 'line-by-line', 'errors', 'tips'],
    execution: input.execution ?? null,
    localAnalysis: input.localAnalysis ?? null,
    sourceExcerpt: excerpt,
    truncated: lines.length > env.aiMaxContextLines,
  });
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, max)
    : [];
}

function objectList(value: unknown, max: number): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null && !Array.isArray(item),
        )
        .slice(0, max)
    : [];
}

export function shapeResponse(parsed: Record<string, unknown>) {
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const deeperExplanation =
    typeof parsed.deeperExplanation === 'string' ? parsed.deeperExplanation.trim() : '';
  if (!summary || !deeperExplanation) {
    throw new Error('provider-shape');
  }

  return {
    source: 'ai' as const,
    summary: summary.slice(0, 1200),
    deeperExplanation: deeperExplanation.slice(0, 2400),
    concepts: stringList(parsed.concepts, 5),
    errors: objectList(parsed.errors, 5),
    debuggingSteps: stringList(parsed.debuggingSteps, 5),
    tips: stringList(parsed.tips, 5),
    additionalQuizQuestions: objectList(parsed.additionalQuizQuestions, 5),
    warnings: stringList(parsed.warnings, 5),
  };
}

function responseText(data: unknown, gemini: boolean): string {
  if (!data || typeof data !== 'object') throw new Error('provider-empty');
  const payload = data as Record<string, unknown>;
  if (gemini) {
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const candidate = candidates[0];
    if (!candidate || typeof candidate !== 'object') throw new Error('provider-empty');
    const content = (candidate as Record<string, unknown>).content;
    if (!content || typeof content !== 'object') throw new Error('provider-empty');
    const parts = (content as Record<string, unknown>).parts;
    if (!Array.isArray(parts)) throw new Error('provider-empty');
    const text = parts
      .filter((part): part is Record<string, unknown> => typeof part === 'object' && part !== null)
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (!text) throw new Error('provider-empty');
    return text;
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const choice = choices[0];
  if (!choice || typeof choice !== 'object') throw new Error('provider-empty');
  const message = (choice as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') throw new Error('provider-empty');
  const text = (message as Record<string, unknown>).content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('provider-empty');
  return text.trim();
}

export function parseProviderResponse(data: unknown, gemini: boolean): Record<string, unknown> {
  const content = responseText(data, gemini);
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  return shapeResponse(JSON.parse(cleaned) as Record<string, unknown>);
}

async function callProvider(userContent: string, repair = false): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);
  try {
    const providerUrl = new URL(env.aiBaseUrl);
    const isGemini = providerUrl.hostname === 'generativelanguage.googleapis.com';
    const requestContent = repair
      ? `Your previous reply did not match the required response shape. Reply with exactly one JSON object containing every required key and non-empty summary and deeperExplanation strings. Do not use markdown.\n${userContent}`
      : userContent;
    const response = isGemini
      ? await fetch(
          `${providerUrl.origin}/v1beta/models/${encodeURIComponent(env.aiModel)}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': env.aiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: requestContent }] }],
              generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
            }),
            signal: controller.signal,
          },
        )
      : await fetch(env.aiBaseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${env.aiKey}` },
          body: JSON.stringify({
            model: env.aiModel,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: requestContent },
            ],
          }),
          signal: controller.signal,
        });
    if (!response.ok) throw new Error('provider-status');
    return parseProviderResponse(await response.json(), isGemini);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One combined AI request per unique code/context combination. Cached results
 * never consume quota, and malformed/failed provider responses are never
 * charged either.
 */
export async function deepAnalyze(input: DeepAnalyzeInput) {
  resetDaily();
  const key = buildCacheKey(input);
  const cached = cache.get(key);
  if (cached) {
    return { ...cached, cached: true, remaining: Math.max(0, env.aiDailyLimit - usage.count) };
  }

  if (!aiConfigured()) {
    throw new Error('AI Deep Help is not configured. Local guidance remains available.');
  }
  if (Date.now() - usage.lastRequestAt < env.aiCooldownSeconds * 1000) {
    throw new Error('AI Deep Help is cooling down. Please continue with local guidance for a moment.');
  }
  if (usage.count >= env.aiDailyLimit) {
    throw new Error('AI Deep Help daily limit reached. Local guidance remains available.');
  }

  const userContent = buildUserContext(input);
  let safe: Record<string, unknown>;
  try {
    safe = await callProvider(userContent);
  } catch {
    try {
      // At most one structured JSON repair retry.
      safe = await callProvider(userContent, true);
    } catch {
      throw new Error('The AI provider did not return usable guidance. Local guidance remains available.');
    }
  }

  cache.set(key, safe, env.aiCacheTtlSeconds * 1000);
  usage.count += 1;
  usage.lastRequestAt = Date.now();
  return { ...safe, cached: false, remaining: Math.max(0, env.aiDailyLimit - usage.count) };
}

export function aiUsage(): AiUsageSnapshot {
  resetDaily();
  return {
    remaining: Math.max(0, env.aiDailyLimit - usage.count),
    limit: env.aiDailyLimit,
    configured: aiConfigured(),
    cooldownSeconds: env.aiCooldownSeconds,
  };
}
