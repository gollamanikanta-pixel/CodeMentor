import { env, executionConfigured } from '../config/env.js';
import type { SecureRunInput, SecureRunResult, SecureRunStatus } from '../types/index.js';
import { MAX_PROVIDER_RESPONSE_BYTES, readBoundedJson, truncateUtf8 } from './providerResponse.js';

export interface SecureExecutionProvider {
  run(input: SecureRunInput): Promise<SecureRunResult>;
}

export const UNAVAILABLE_MESSAGE =
  'Secure execution is not configured. Add the execution-provider settings in server/.env to run C, C++, and Java.';

const usage = { day: new Date().toISOString().slice(0, 10), count: 0, lastRequestAt: 0 };

function resetUsage() {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) {
    usage.day = today;
    usage.count = 0;
    usage.lastRequestAt = 0;
  }
}

/** Read-only snapshot of today's secure-execution accounting. */
export function executionUsageSnapshot(): { count: number; lastRequestAt: number } {
  resetUsage();
  return { count: usage.count, lastRequestAt: usage.lastRequestAt };
}

/**
 * Shared guard applied by every remote provider before a run, so the daily cap
 * and cooldown are enforced consistently (and public runner rate limits are not
 * tripped) within this server process, regardless of which adapter is configured.
 * This in-memory guard is best-effort, not an account quota or a distributed lock.
 */
export function executionGuard(): { ok: true } | { ok: false; message: string } {
  resetUsage();
  if (usage.count >= env.executionDailyLimit) {
    return { ok: false, message: 'Secure execution daily limit reached. Local guidance remains available.' };
  }
  if (Date.now() - usage.lastRequestAt < env.executionCooldownSeconds * 1000) {
    return { ok: false, message: 'Secure execution is cooling down. Please try again shortly.' };
  }
  return { ok: true };
}

/** Records one accepted remote run so the day's accounting stays truthful. */
export function recordExecution(): void {
  resetUsage();
  usage.count += 1;
  usage.lastRequestAt = Date.now();
}

function unavailable(message = UNAVAILABLE_MESSAGE, status: SecureRunStatus = 'unavailable'): SecureRunResult {
  return {
    status,
    stdout: '',
    stderr: '',
    compileOutput: '',
    message,
    time: null,
    memory: null,
    exitCode: null,
    errorLine: null,
    errorLineConfidence: 'unknown',
    executionMode: 'secure_remote',
  };
}

const SECURE_RUN_STATUSES: readonly SecureRunStatus[] = [
  'success',
  'compilation_error',
  'runtime_error',
  'time_limit_exceeded',
  'memory_limit_exceeded',
  'internal_error',
  'unavailable',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSecureRunStatus(value: unknown): value is SecureRunStatus {
  return typeof value === 'string' && SECURE_RUN_STATUSES.includes(value as SecureRunStatus);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Copies only learner-facing execution fields from the untrusted provider response. */
export function normalizeLiveProviderResult(value: unknown, source: string): SecureRunResult {
  if (!isRecord(value) || !isSecureRunStatus(value.status)) {
    return unavailable('The secure provider returned an invalid result.', 'internal_error');
  }

  const lineCount = source.split(/\r\n|\r|\n/).length;
  const proposedLine = value.errorLine;
  const errorLine = typeof proposedLine === 'number' &&
    Number.isSafeInteger(proposedLine) &&
    proposedLine > 0 &&
    proposedLine <= lineCount
    ? proposedLine
    : null;
  const confidence =
    errorLine !== null && (value.errorLineConfidence === 'exact' || value.errorLineConfidence === 'estimated')
      ? value.errorLineConfidence
      : 'unknown';
  const text = (field: unknown, limit = env.executionMaxOutputBytes) =>
    typeof field === 'string' ? truncateUtf8(field, limit) : '';
  const message = typeof value.message === 'string' ? value.message.slice(0, 300) : '';
  const proposedExitCode = value.exitCode;
  const exitCode =
    typeof proposedExitCode === 'number' && Number.isSafeInteger(proposedExitCode) ? proposedExitCode : null;

  return {
    status: value.status,
    stdout: text(value.stdout),
    stderr: text(value.stderr),
    compileOutput: text(value.compileOutput),
    message,
    time: finiteNumber(value.time),
    memory: finiteNumber(value.memory),
    exitCode,
    errorLine,
    errorLineConfidence: confidence,
    executionMode: 'secure_remote',
  };
}

/** Safe fallback used whenever no secure provider is configured. */
export class UnavailableExecutionProvider implements SecureExecutionProvider {
  async run(): Promise<SecureRunResult> {
    return unavailable();
  }
}

/**
 * Delegates to a vetted remote runner. This backend never compiles or executes
 * student code itself — there is no child_process, shell, compiler or Docker
 * path anywhere in this repository.
 */
export class LiveSecureExecutionProvider implements SecureExecutionProvider {
  async run(input: SecureRunInput): Promise<SecureRunResult> {
    if (!executionConfigured()) return unavailable();
    const guard = executionGuard();
    if (!guard.ok) return unavailable(guard.message);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
    try {
      const response = await fetch(env.executionBaseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.executionKey}` },
        body: JSON.stringify({
          language: input.language,
          source: input.source,
          stdin: input.stdin,
          files: input.files ?? [],
          entryFile: input.entryFile,
          limits: {
            timeMs: env.runTimeoutMs,
            outputBytes: env.executionMaxOutputBytes,
            memoryBytes: 268435456,
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return unavailable('The secure provider did not accept this learning run.', 'internal_error');
      }
      recordExecution();
      const data = await readBoundedJson<unknown>(response, MAX_PROVIDER_RESPONSE_BYTES);
      return normalizeLiveProviderResult(data, input.source);
    } catch {
      return unavailable('The secure provider could not be reached safely.', 'internal_error');
    } finally {
      clearTimeout(timer);
    }
  }
}
