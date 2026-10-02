import { env } from '../config/env.js';
import type { SecureRunFile, SecureRunInput, SecureRunResult, SecureRunStatus } from '../types/index.js';
import { executionGuard, recordExecution, type SecureExecutionProvider } from './secureExecutionProvider.js';
import { normalizePistonRun, type PistonResponse } from './pistonNormalizer.js';

/**
 * Piston (https://github.com/engineer-man/piston) adapter.
 *
 * The public Piston API is keyless by design: it exposes `GET /runtimes` and
 * `POST /execute` with no subscription flow. All calls happen here, on the
 * backend — the browser never talks to Piston, and this project still has no
 * `child_process`, shell, compiler or Docker path.
 *
 * Piston is rate-limited and offered for light local/student testing, not as a
 * guaranteed high-traffic production service.
 */

export const PISTON_LANGUAGE: Record<string, string> = {
  c: 'c',
  cpp: 'c++',
  java: 'java',
  csharp: 'csharp',
  go: 'go',
  php: 'php',
  ruby: 'ruby',
  rust: 'rust',
  kotlin: 'kotlin',
};

export const PISTON_SUPPORTED = Object.keys(PISTON_LANGUAGE);

/**
 * Piston runs whatever file matches the runtime, so an unnamed single file still
 * needs the right extension to compile/run at all.
 */
const PISTON_FALLBACK_FILENAME: Record<string, string> = {
  c: 'main.c',
  cpp: 'main.cpp',
  java: 'Main.java',
  csharp: 'Main.cs',
  go: 'main.go',
  php: 'main.php',
  ruby: 'main.rb',
  rust: 'main.rs',
  kotlin: 'Main.kt',
};

type PistonRuntime = { language: string; version: string; aliases?: string[]; runtime?: string };

const CACHE_TTL_MS = 10 * 60 * 1000;

let runtimeCache: { at: number; runtimes: PistonRuntime[] } | null = null;
let runtimeInflight: Promise<PistonRuntime[]> | null = null;

/** Fetches and caches the runtime list. Cached for 10 minutes server-side. */
export async function fetchPistonRuntimes(force = false): Promise<PistonRuntime[]> {
  if (!force && runtimeCache && Date.now() - runtimeCache.at < CACHE_TTL_MS) return runtimeCache.runtimes;
  if (!force && runtimeInflight) return runtimeInflight;

  runtimeInflight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
    try {
      const response = await fetch(`${env.executionBaseUrl.replace(/\/$/, '')}/runtimes`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Piston runtimes responded ${response.status}`);
      const runtimes = (await response.json()) as PistonRuntime[];
      if (!Array.isArray(runtimes)) throw new Error('Piston runtimes payload was not a list');
      runtimeCache = { at: Date.now(), runtimes };
      return runtimes;
    } finally {
      clearTimeout(timer);
      runtimeInflight = null;
    }
  })();

  return runtimeInflight;
}

/** Resolves the newest available runtime version for a CodeMentor language. */
export async function resolvePistonRuntime(language: string): Promise<{ language: string; version: string } | null> {
  const pistonLanguage = PISTON_LANGUAGE[language];
  if (!pistonLanguage) return null;
  try {
    const runtimes = await fetchPistonRuntimes();
    const matches = runtimes.filter(
      (runtime) => runtime.language === pistonLanguage || (runtime.aliases ?? []).includes(pistonLanguage),
    );
    if (!matches.length) return null;
    // Prefer the highest semantic version when several are published.
    const best = matches
      .slice()
      .sort((a, b) => compareVersions(b.version, a.version))[0];
    return { language: best.language, version: best.version };
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(pa.length, pb.length); index += 1) {
    const diff = (pa[index] ?? 0) - (pb[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Reads a safe, short explanation from an error response body. */
async function providerMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return '';
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      /* plain text body */
    }
    return message.replace(/\s+/g, ' ').trim().slice(0, 300);
  } catch {
    return '';
  }
}

const PROBE_PROGRAM = '#include <stdio.h>\nint main(void){ puts("ok"); return 0; }';

/**
 * Runs one tiny program to prove execute really works. Used by the capabilities
 * endpoint so the UI never claims "Secure runner ready" on a runner that can
 * list runtimes but refuses to execute.
 */
export async function probePistonExecution(): Promise<{ ok: boolean; message: string }> {
  const runtime = await resolvePistonRuntime('c');
  if (!runtime) return { ok: false, message: 'No C runtime is published by this runner.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
  try {
    const response = await fetch(`${env.executionBaseUrl.replace(/\/$/, '')}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: 'main.c', content: PROBE_PROGRAM }],
        stdin: '',
        compile_timeout: 10000,
        run_timeout: 3000,
        run_memory_limit: 268435456,
      }),
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, message: 'Execution probe succeeded.' };
    const detail = await providerMessage(response);
    return { ok: false, message: detail || `The runner responded ${response.status}.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.name === 'AbortError' ? 'The runner did not respond in time.' : 'The runner could not be reached.',
    };
  } finally {
    clearTimeout(timer);
  }
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

/** Builds Piston's `files` array from the validated project snapshot. */
export function buildPistonFiles(input: SecureRunInput): SecureRunFile[] {
  const files = input.files?.filter((file) => file.relativePath && typeof file.content === 'string') ?? [];
  if (files.length) {
    return files.map((file) => ({ relativePath: file.relativePath, content: file.content }));
  }
  const fallbackName = PISTON_FALLBACK_FILENAME[input.language] ?? 'main.txt';
  return [{ relativePath: fallbackName, content: input.source }];
}

export class PistonExecutionProvider implements SecureExecutionProvider {
  async run(input: SecureRunInput): Promise<SecureRunResult> {
    if (!env.executionBaseUrl) {
      return unavailable('Secure execution is not configured. Add the execution-provider settings in server/.env to run C, C++, and Java.');
    }

    const runtime = await resolvePistonRuntime(input.language);
    if (!runtime) {
      return unavailable(
        'The secure runner is reachable but has no runtime for this language yet. Local guidance remains available.',
      );
    }

    // Shared daily cap + cooldown, so public runner limits are never what the
    // learner sees.
    const guard = executionGuard();
    if (!guard.ok) return unavailable(guard.message);

    const files = buildPistonFiles(input).map((file) => ({
      // Piston only accepts relative names; keep the learner's own filename so
      // Java class names and C/C++ header includes stay valid.
      name: file.relativePath,
      content: file.content,
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.executionTimeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${env.executionBaseUrl.replace(/\/$/, '')}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          language: runtime.language,
          version: runtime.version,
          files,
          stdin: input.stdin ?? '',
          compile_timeout: 10000,
          run_timeout: env.runTimeoutMs,
          run_memory_limit: 268435456,
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        return unavailable('The secure runner is rate limited right now. Please try again shortly — local guidance remains available.');
      }
      if (response.status === 401 || response.status === 403) {
        const detail = await providerMessage(response);
        return unavailable(
          `The secure runner rejected this request because it is not authorised.${detail ? ` ${detail}` : ''}`,
        );
      }
      if (!response.ok) {
        const detail = await providerMessage(response);
        return unavailable(
          `The secure provider did not accept this learning run.${detail ? ` ${detail}` : ''}`,
          'internal_error',
        );
      }

      recordExecution();
      const data = (await response.json()) as PistonResponse;
      const elapsed = Date.now() - startedAt;

      // One shared, unit-tested normalizer maps Piston's raw payload onto the
      // honest result model (compilation/runtime/timeout statuses included).
      return normalizePistonRun(data, elapsed);
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
