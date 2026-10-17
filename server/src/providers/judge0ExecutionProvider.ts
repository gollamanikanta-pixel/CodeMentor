import { env } from '../config/env.js';
import type { SecureRunInput, SecureRunResult, SecureRunStatus } from '../types/index.js';
import { executionGuard, recordExecution, type SecureExecutionProvider } from './secureExecutionProvider.js';
import { normalizeJudge0Run, type Judge0Response } from './judge0Normalizer.js';
import { MAX_PROVIDER_RESPONSE_BYTES, readBoundedJson, readBoundedText } from './providerResponse.js';

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

export const JUDGE0_RESOURCE_LIMITS = {
  cpu_time_limit: Math.min(5, Math.max(0.1, env.runTimeoutMs / 1000)),
  cpu_extra_time: 1,
  wall_time_limit: Math.max(1, Math.min(15, (env.runTimeoutMs + 2000) / 1000)),
  memory_limit: 256 * 1024,
  stack_limit: 64 * 1024,
  max_processes_and_or_threads: 20,
  max_file_size: 1024,
  number_of_runs: 1,
  enable_network: false,
  enable_per_process_and_thread_time_limit: true,
  enable_per_process_and_thread_memory_limit: true,
} as const;

export function buildJudge0Submission(source: string, languageId: number, stdin: string) {
  return {
    source_code: source,
    language_id: languageId,
    stdin,
    ...JUDGE0_RESOURCE_LIMITS,
  };
}

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
    const text = await readBoundedText(response, 4096);
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
const PROBE_PROGRAMS: Record<string, string> = {
  c: PROBE_PROGRAM,
  java: 'public class Main { public static void main(String[] args) { System.out.println("ok"); } }',
};
const PROBE_CACHE_TTL_MS = 60_000;
const probeCache = new Map<string, { expiresAt: number; result: { ok: boolean; message: string } }>();
const pendingProbes = new Map<string, Promise<{ ok: boolean; message: string }>>();

/**
 * Runs a tiny program to prove a language really executes. Used by the
 * capabilities endpoint so the UI never claims a language is ready based only
 * on the provider responding to a different language.
 */
export function probeJudge0Execution(language = 'c'): Promise<{ ok: boolean; message: string }> {
  const cached = probeCache.get(language);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
  const pending = pendingProbes.get(language);
  if (pending) return pending;
  const request = runJudge0Probe(language)
    .then((result) => {
      probeCache.set(language, { expiresAt: Date.now() + PROBE_CACHE_TTL_MS, result });
      return result;
    })
    .finally(() => pendingProbes.delete(language));
  pendingProbes.set(language, request);
  return request;
}

async function runJudge0Probe(language: string): Promise<{ ok: boolean; message: string }> {
  if (!env.judge0BaseUrl) return { ok: false, message: 'Secure execution is not configured.' };
  const languageId = JUDGE0_LANGUAGE_ID[language];
  const source = PROBE_PROGRAMS[language];
  if (!languageId || !source) return { ok: false, message: `No readiness probe is defined for ${language}.` };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
  try {
    const response = await fetch(submissionsUrl(), {
      ...requestInit(buildJudge0Submission(source, languageId, '')),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await providerMessage(response);
      return { ok: false, message: detail || `The runner responded ${response.status}.` };
    }
    const result = await readBoundedJson<Judge0Response>(response, MAX_PROVIDER_RESPONSE_BYTES);
    if (result.status?.id === 3) {
      return { ok: true, message: `${language} execution probe succeeded.` };
    }
    const detail =
      result.compile_output || result.stderr || result.message || result.status?.description || 'The program did not complete successfully.';
    return {
      ok: false,
      message: `${language} readiness probe failed: ${detail.replace(/\s+/g, ' ').trim().slice(0, 240)}`,
    };
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
        ...requestInit(buildJudge0Submission(source, languageId, input.stdin ?? '')),
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
      const data = await readBoundedJson<Judge0Response>(response, MAX_PROVIDER_RESPONSE_BYTES);
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
