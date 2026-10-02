import { env, executionConfigured, judge0AvailableAsFallback, usingJudge0, usingPiston } from '../config/env.js';
import type { ExecutionUsageSnapshot, SecureRunInput, SecureRunResult } from '../types/index.js';
import {
  executionUsageSnapshot,
  LiveSecureExecutionProvider,
  UnavailableExecutionProvider,
  type SecureExecutionProvider,
} from './secureExecutionProvider.js';
import {
  fetchPistonRuntimes,
  PISTON_LANGUAGE,
  PISTON_SUPPORTED,
  PistonExecutionProvider,
  probePistonExecution,
  resolvePistonRuntime,
} from './pistonExecutionProvider.js';
import {
  JUDGE0_SUPPORTED,
  Judge0ExecutionProvider,
  probeJudge0Execution,
} from './judge0ExecutionProvider.js';

/** Human labels for readiness messages. */
const LANGUAGE_LABEL: Record<string, string> = {
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  csharp: 'C#',
  go: 'Go',
  php: 'PHP',
  ruby: 'Ruby',
  rust: 'Rust',
  kotlin: 'Kotlin',
};

/** Languages a vetted remote runner can serve today. */
export const ENABLED_LANGUAGES = ['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin'] as const;

/** The subset this project currently wires to the Piston adapter. */
export const PISTON_LANGUAGES = PISTON_SUPPORTED;

function isEnabledLanguage(language: string) {
  return ENABLED_LANGUAGES.includes(language as (typeof ENABLED_LANGUAGES)[number]);
}

/**
 * Messages that mean the configured runner will not execute anonymous learner
 * code — e.g. the public Piston API's 2026-02-15 whitelist-only change, or a
 * runner that is simply unreachable.
 */
const RUNNER_REFUSED =
  /not authorised|rejected this request|could not be reached|could not be reached safely|no runtime for this language|rate limited/i;

/**
 * Runs on the configured provider and, if it refuses to execute, retries the
 * exact same, unmodified source on Judge0 CE. A real compile or runtime result
 * is never replaced — only a refusal is. Code is still never compiled on this
 * backend: both providers are remote sandboxes.
 */
class ResilientExecutionProvider implements SecureExecutionProvider {
  private readonly primary = new PistonExecutionProvider();
  private readonly fallback = new Judge0ExecutionProvider();

  async run(input: SecureRunInput): Promise<SecureRunResult> {
    const first = await this.primary.run(input);
    const refused = (first.status === 'unavailable' || first.status === 'internal_error') && RUNNER_REFUSED.test(first.message);
    if (refused && JUDGE0_SUPPORTED.includes(input.language)) {
      const second = await this.fallback.run(input);
      if (second.status !== 'unavailable') return second;
    }
    return first;
  }
}

/**
 * Picks the execution provider for a language.
 * - `EXECUTION_PROVIDER=judge0` uses the keyless Judge0 CE adapter, which
 *   serves every compiled language CodeMentor offers (Kotlin included).
 * - `EXECUTION_PROVIDER=piston` uses the keyless Piston adapter for every
 *   language `PISTON_LANGUAGE` maps.
 * - Otherwise a URL + key selects the generic live adapter.
 * - With nothing configured the honest unavailable fallback is returned.
 */
export function selectExecutionProvider(language: string): SecureExecutionProvider {
  if (usingJudge0()) {
    if (!JUDGE0_SUPPORTED.includes(language)) return new UnavailableExecutionProvider();
    return new Judge0ExecutionProvider();
  }
  if (usingPiston()) {
    if (!PISTON_LANGUAGES.includes(language)) return new UnavailableExecutionProvider();
    return judge0AvailableAsFallback() ? new ResilientExecutionProvider() : new PistonExecutionProvider();
  }
  if (!executionConfigured()) return new UnavailableExecutionProvider();
  if (!isEnabledLanguage(language)) return new UnavailableExecutionProvider();
  return new LiveSecureExecutionProvider();
}

export type { SecureExecutionProvider } from './secureExecutionProvider.js';

export function executionUsage(): ExecutionUsageSnapshot {
  const { count } = executionUsageSnapshot();
  const enabled = usingJudge0()
    ? [...JUDGE0_SUPPORTED]
    : usingPiston()
      ? [...PISTON_LANGUAGES]
      : isConfigured()
        ? [...ENABLED_LANGUAGES]
        : [];
  return {
    remaining: executionConfigured() ? Math.max(0, env.executionDailyLimit - count) : 0,
    limit: env.executionDailyLimit,
    configured: executionConfigured(),
    cooldownSeconds: env.executionCooldownSeconds,
    enabledLanguages: enabled,
  };
}

function isConfigured() {
  return executionConfigured();
}

export type ExecutionCapability = {
  ready: boolean;
  version: string | null;
  note: string;
};

export type ExecutionCapabilities = {
  provider: string;
  reachable: boolean;
  checkedAt: string;
  languages: Record<string, ExecutionCapability>;
  message: string;
};

/**
 * Reports what the configured runner can actually do right now. This is the
 * source of truth for "Secure runner ready" in the UI — it probes the runner
 * rather than assuming, and never claims readiness that is not real.
 */
export async function executionCapabilities(): Promise<ExecutionCapabilities> {
  const checkedAt = new Date().toISOString();

  if (!executionConfigured()) {
    return {
      provider: 'unavailable',
      reachable: false,
      checkedAt,
      languages: {},
      message:
        'Secure execution is not configured. Add the execution-provider settings in server/.env to run C, C++, and Java.',
    };
  }

  if (usingJudge0()) {
    const probe = await probeJudge0Execution();
    if (!probe.ok) {
      return {
        provider: 'judge0',
        reachable: false,
        checkedAt,
        languages: Object.fromEntries(
          JUDGE0_SUPPORTED.map((language) => [language, { ready: false, version: null, note: probe.message }]),
        ),
        message: `The secure runner is reachable but cannot execute learner code yet: ${probe.message}`,
      };
    }
    return {
      provider: 'judge0',
      reachable: true,
      checkedAt,
      languages: Object.fromEntries(
        JUDGE0_SUPPORTED.map((language) => [
          language,
          { ready: true, version: null, note: 'Judge0 CE remote runtime.' },
        ]),
      ),
      message: `Secure runner ready for ${JUDGE0_SUPPORTED.map((language) => LANGUAGE_LABEL[language] ?? language).join(', ')}.`,
    };
  }

  if (!usingPiston()) {
    return {
      provider: 'live',
      reachable: true,
      checkedAt,
      languages: Object.fromEntries(
        ENABLED_LANGUAGES.map((language) => [language, { ready: true, version: null, note: 'Configured secure provider.' }]),
      ),
      message: 'A secure execution provider is configured.',
    };
  }

  let runtimesOk = true;
  try {
    await fetchPistonRuntimes();
  } catch {
    runtimesOk = false;
  }

  const unreachable = (note: string): ExecutionCapabilities => ({
    provider: 'piston',
    reachable: false,
    checkedAt,
    languages: Object.fromEntries(PISTON_LANGUAGES.map((language) => [language, { ready: false, version: null, note }])),
    message: 'The secure runner could not be reached. Local guidance remains available.',
  });

  /**
   * When the configured runner refuses to run code, report the Judge0 fallback
   * — but only after proving with a real probe that it can execute. Nothing is
   * announced as ready on an assumption.
   */
  const tryJudge0Fallback = async (): Promise<ExecutionCapabilities | null> => {
    if (!judge0AvailableAsFallback()) return null;
    const probe = await probeJudge0Execution();
    if (!probe.ok) return null;
    return {
      provider: 'judge0',
      reachable: true,
      checkedAt,
      languages: Object.fromEntries(
        JUDGE0_SUPPORTED.map((language) => [language, { ready: true, version: null, note: 'Judge0 CE fallback runtime.' }]),
      ),
      message: `Secure runner ready for ${JUDGE0_SUPPORTED.map((language) => LANGUAGE_LABEL[language] ?? language).join(', ')}.`,
    };
  };

  if (!runtimesOk) return (await tryJudge0Fallback()) ?? unreachable('Secure runner unreachable.');

  // Listing runtimes is not enough — prove that execution is actually allowed.
  const probe = await probePistonExecution();
  if (!probe.ok) {
    const fallback = await tryJudge0Fallback();
    if (fallback) return fallback;
    return {
      provider: 'piston',
      reachable: false,
      checkedAt,
      languages: Object.fromEntries(
        PISTON_LANGUAGES.map((language) => [language, { ready: false, version: null, note: probe.message }]),
      ),
      message: `The secure runner is reachable but cannot execute learner code yet: ${probe.message}`,
    };
  }

  const languages: Record<string, ExecutionCapability> = {};
  for (const language of Object.keys(PISTON_LANGUAGE)) {
    const runtime = await resolvePistonRuntime(language);
    languages[language] = runtime
      ? { ready: true, version: runtime.version, note: `Piston runtime ${runtime.language} ${runtime.version}` }
      : { ready: false, version: null, note: 'No runtime published for this language.' };
  }

  const ready = Object.entries(languages).filter(([, entry]) => entry.ready);

  return {
    provider: 'piston',
    reachable: true,
    checkedAt,
    languages,
    message: ready.length
      ? `Secure runner ready for ${ready.map(([language]) => LANGUAGE_LABEL[language] ?? language).join(', ')}.`
      : 'The secure runner is reachable but publishes no runtime for these languages.',
  };
}
