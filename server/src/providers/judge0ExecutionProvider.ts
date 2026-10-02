import { env } from '../config/env.js';
import type { SecureRunInput, SecureRunResult, SecureRunStatus } from '../types/index.js';
import { executionGuard, recordExecution, type SecureExecutionProvider } from './secureExecutionProvider.js';
import { normalizeJudge0Run, type Judge0Response } from './judge0Normalizer.js';

/**
 * Judge0 CE adapter (https://ce.judge0.com).
 *
 * Judge0 is a keyless, open-source remote code-execution service: the public CE
 * instance accepts `POST /submissions` with no subscription flow. It is used
 * here as an alternative to Piston, whose public API became whitelist-only on
 * 2026-02-15. As with every provider in this folder, all calls happen on the
 * backend — the browser never talks to Judge0, and this project still has no
 * `child_process`, shell, compiler or Docker path anywhere in the repository.
 */

/**
 * Judge0 CE language ids, verified live against `GET /languages`.
 * Kotlin, which Wandbox lacks, is why Judge0 is the recommended provider.
 */
export const JUDGE0_LANGUAGE_ID: Record<string, number> = {
  c: 103, // C (GCC 14.1.0)
  cpp: 105, // C++ (GCC 14.1.0)
  java: 91, // Java (JDK 17.0.6)
  csharp: 51, // C# (Mono 6.6.0.161)
  go: 107, // Go (1.23.5)
  php: 98, // PHP (8.3.11)
  ruby: 72, // Ruby (2.7.0)
  rust: 108, // Rust (1.85.0)
  kotlin: 111, // Kotlin (2.1.10)
};

export const JUDGE0_SUPPORTED = Object.keys(JUDGE0_LANGUAGE_ID);

const UNAVAILABLE_MESSAGE =
  'Secure execution is not configured. Add the execution-provider settings in server/.env to run C, C++, and Java.';

function unavailable(message: string, status: SecureRunStatus = 'unavailable'): SecureRunResult {
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

/** Reads a safe, short explanation from an error response body. */
async function providerMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return '';
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed?.message || parsed?.error || message;
    } catch {
      /* plain text body */
    }
    return message.replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch {
    return '';
  }
}

function submissionsUrl(): string {
  return `${env.judge0BaseUrl.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`;
}

function requestInit(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      // Judge0 rejects requests without a descriptive User-Agent.
      'user-agent': 'CodeMentor/1.0 (+local-first learning runner)',
    },
    body: JSON.stringify(body),
  };
}

const PROBE_PROGRAM = '#include <stdio.h>\nint main(void){ puts("ok"); return 0; }';

/**
 * Runs one tiny C program to prove submissions really execute. Used by the
 * capabilities endpoint so the UI never claims "Secure runner ready" on a
 * service that lists languages but refuses to run code.
 */
export async function probeJudge0Execution(): Promise<{ ok: boolean; message: string }> {
  if (!env.judge0BaseUrl) return { ok: false, message: 'Secure execution is not configured.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
  try {
    const response = await fetch(submissionsUrl(), {
      ...requestInit({ source_code: PROBE_PROGRAM, language_id: JUDGE0_LANGUAGE_ID.c, stdin: '' }),
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, message: 'Execution probe succeeded.' };
    const detail = await providerMessage(response);
    return { ok: false, message: detail || `The runner responded ${response.status}.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === 'AbortError'
          ? 'The runner did not respond in time.'
          : 'The runner could not be reached.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export class Judge0ExecutionProvider implements SecureExecutionProvider {
  async run(input: SecureRunInput): Promise<SecureRunResult> {
    if (!env.judge0BaseUrl) return unavailable(UNAVAILABLE_MESSAGE);

    const languageId = JUDGE0_LANGUAGE_ID[input.language];
    if (!languageId) {
      return unavailable(
        'The secure runner has no runtime for this language yet. Local guidance remains available.',
      );
    }

    // Judge0 CE compiles a single source file. For a multi-file project we run
    // the learner's entry file exactly as written — CodeMentor never edits it.
    const source = input.source ?? '';
    if (!source.trim()) {
      return unavailable('Write or paste some code first, then run it again.', 'internal_error');
    }

    // Respect the shared daily cap + cooldown so Judge0's public rate limit is
    // never the thing the learner sees.
    const guard = executionGuard();
    if (!guard.ok) return unavailable(guard.message);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(submissionsUrl(), {
        ...requestInit({
          source_code: source,
          language_id: languageId,
          stdin: input.stdin ?? '',
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        return unavailable(
          'The secure runner is rate limited right now. Please try again shortly — local guidance remains available.',
        );
      }
      if (response.status === 401 || response.status === 403) {
        const detail = await providerMessage(response);
        return unavailable(`The secure runner rejected this request because it is not authorised.${detail ? ` ${detail}` : ''}`);
      }
      if (!response.ok) {
        const detail = await providerMessage(response);
        return unavailable(
          `The secure provider did not accept this learning run.${detail ? ` ${detail}` : ''}`,
          'internal_error',
        );
      }

      recordExecution();
      const data = (await response.json()) as Judge0Response;
      return normalizeJudge0Run(data, Date.now() - startedAt);
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return unavailable(
        aborted
          ? 'The secure provider did not respond in time. Local guidance remains available.'
          : 'The secure provider could not be reached safely.',
        'internal_error',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
