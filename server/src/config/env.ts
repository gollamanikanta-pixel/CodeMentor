import 'dotenv/config';

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const rawExecutionProvider = (process.env.EXECUTION_PROVIDER || '').trim().toLowerCase();
const rawExecutionBaseUrl = process.env.EXECUTION_API_BASE_URL || '';

/**
 * Server-only configuration. Every secret is read here and never leaves the
 * backend — the browser only ever receives usage counts and safe status flags.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  // Account storage (SQLite). Optional — the workspace still runs locally
  // without an account, but projects/execution history need auth.
  databaseUrl: process.env.DATABASE_URL || 'file:./data/codementor.db',
  sessionSecret: process.env.SESSION_SECRET || 'development-only-change-me',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'codementor_session',
  sessionTtlDays: num(process.env.SESSION_TTL_DAYS, 7),

  // AI Deep Help (optional, backend-only).
  aiBaseUrl: process.env.AI_API_BASE_URL || '',
  aiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || '',
  aiTimeoutMs: num(process.env.AI_API_TIMEOUT_MS, 30000),
  aiDailyLimit: num(process.env.AI_DAILY_LIMIT, 3),
  aiCooldownSeconds: num(process.env.AI_COOLDOWN_SECONDS, 30),
  aiCacheTtlSeconds: num(process.env.AI_CACHE_TTL_SECONDS, 86400),
  aiMaxSourceChars: num(process.env.AI_MAX_SOURCE_CHARS, 12000),
  aiMaxContextLines: num(process.env.AI_MAX_CONTEXT_LINES, 80),

  // Local runner hints (browser-side limits mirrored for validation).
  runTimeoutMs: num(process.env.RUN_TIMEOUT_MS, 3000),
  maxCodeBytes: num(process.env.MAX_CODE_SIZE_BYTES, 51200),
  maxStdinBytes: num(process.env.MAX_STDIN_SIZE_BYTES, 10240),

  // Secure remote execution (optional, backend-only).
  // `piston` selects the built-in Piston adapter; anything else falls back to
  // the generic live adapter below.
  executionProvider: rawExecutionProvider,
  executionBaseUrl: rawExecutionBaseUrl,
  executionKey: process.env.EXECUTION_API_KEY || '',

  // Judge0 CE is keyless. When Judge0 is the chosen provider we honour
  // EXECUTION_API_BASE_URL; otherwise this defaults to the public CE instance so
  // the fallback runner below always has somewhere to go.
  judge0BaseUrl:
    (process.env.EXECUTION_JUDGE0_BASE_URL || '').trim() ||
    (rawExecutionProvider === 'judge0' && rawExecutionBaseUrl ? rawExecutionBaseUrl : '') ||
    'https://ce.judge0.com',

  // If a configured runner refuses to execute anonymous code (e.g. the public
  // Piston API became whitelist-only on 2026-02-15), retry the run on Judge0 CE
  // rather than dead-ending the learner. Set to `false` to disable the retry.
  judge0Fallback: (process.env.EXECUTION_JUDGE0_FALLBACK || 'true').trim().toLowerCase() !== 'false',
  executionTimeoutMs: num(process.env.EXECUTION_API_TIMEOUT_MS, 15000),
  executionDailyLimit: num(process.env.EXECUTION_DAILY_LIMIT, 20),
  executionCooldownSeconds: num(process.env.EXECUTION_COOLDOWN_SECONDS, 5),
  executionMaxOutputBytes: num(process.env.EXECUTION_MAX_OUTPUT_BYTES, 100000),
  executionMaxFiles: num(process.env.EXECUTION_MAX_FILES, 30),
  executionMaxProjectBytes: num(process.env.EXECUTION_MAX_PROJECT_BYTES, 512000),
  executionMaxFileBytes: num(process.env.EXECUTION_MAX_FILE_BYTES, 51200),

  // Separate hosted runner service provides interactive stdin/stdout sessions.
  terminalRunnerUrl: (process.env.TERMINAL_RUNNER_URL || '').trim(),
  terminalRunnerSecret: process.env.TERMINAL_RUNNER_SECRET || '',
  terminalRunnerTimeoutMs: num(process.env.TERMINAL_RUNNER_TIMEOUT_MS, 70000),
  terminalRunnerMaxOutputBytes: num(process.env.TERMINAL_RUNNER_MAX_OUTPUT_BYTES, 200000),
} as const;

export const aiConfigured = () => Boolean(env.aiBaseUrl && env.aiKey && env.aiModel);

/**
 * The Piston public API is intentionally keyless, so an empty key must not
 * disable execution when the provider is explicitly set to `piston`.
 */
export const usingPiston = () => env.executionProvider === 'piston' && Boolean(env.executionBaseUrl);

/**
 * Judge0 CE is likewise keyless: setting `EXECUTION_PROVIDER=judge0` plus a base
 * URL is enough. It is the recommended provider because it publishes runtimes
 * for every compiled language CodeMentor offers, Kotlin included.
 */
export const usingJudge0 = () => env.executionProvider === 'judge0';

/** A non-Judge0 provider is configured, but Judge0 may still rescue the run. */
export const judge0AvailableAsFallback = () =>
  !usingJudge0() && env.judge0Fallback && Boolean(env.judge0BaseUrl);

export const executionConfigured = () =>
  usingPiston() || usingJudge0() || Boolean(env.executionBaseUrl && env.executionKey);

export const terminalRunnerConfigured = () => {
  if (!env.terminalRunnerUrl || !env.terminalRunnerSecret) return false;
  try {
    const url = new URL(env.terminalRunnerUrl);
    return ['ws:', 'wss:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
};
