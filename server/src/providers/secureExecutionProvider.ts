import { env, executionConfigured } from '../config/env.js';
import type { SecureRunInput, SecureRunResult, SecureRunStatus } from '../types/index.js';

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
 * tripped) regardless of which adapter is configured.
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
      const data = (await response.json()) as Partial<SecureRunResult>;
      return {
        ...unavailable('', 'success'),
        ...data,
        status: (data.status as SecureRunStatus) ?? 'internal_error',
        executionMode: 'secure_remote',
      };
    } catch {
      return unavailable('The secure provider could not be reached safely.', 'internal_error');
    } finally {
      clearTimeout(timer);
    }
  }
}
