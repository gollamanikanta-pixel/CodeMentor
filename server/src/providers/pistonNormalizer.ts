import { env } from '../config/env.js';
import type { SecureRunStatus } from '../types/index.js';
import { errorLineFromOutput } from './executionErrorLine.js';
import { truncateUtf8 } from './providerResponse.js';

/**
 * Normalizes Piston's raw run/compile payloads onto CodeMentor's honest result
 * model. Pure functions only: no fetch, no clock, no environment mutation — so
 * the status mapping rules are unit-testable in isolation (§19/§38).
 */

type PistonExecution = { stdout?: string; stderr?: string; output?: string; code?: number | null; signal?: string | null };

export type PistonResponse = {
  language?: string;
  version?: string;
  run?: PistonExecution | null;
  compile?: PistonExecution | null;
  message?: string;
};

/**
 * Best-effort compiler/runtime error line, e.g. `main.c:5:3: error:`. The rule
 * lives in one shared module so every provider normalizer agrees on it.
 */
export { errorLineFromOutput as errorLineFromPistonOutput } from './executionErrorLine.js';

function truncateOutput(value: string): string {
  return truncateUtf8(value, env.executionMaxOutputBytes);
}

export type NormalizedPistonRun = {
  status: SecureRunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  time: number;
  memory: null;
  exitCode: number | null;
  errorLine: number | null;
  errorLineConfidence: 'exact' | 'estimated' | 'unknown';
  executionMode: 'secure_remote';
};

/** Maps one Piston `execute` response body onto the shared result shape. */
export function normalizePistonRun(data: PistonResponse, elapsedMs: number): NormalizedPistonRun {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      status: 'internal_error',
      stdout: '',
      stderr: '',
      compileOutput: '',
      message: 'The secure runner returned an invalid result.',
      time: elapsedMs,
      memory: null,
      exitCode: null,
      errorLine: null,
      errorLineConfidence: 'unknown',
      executionMode: 'secure_remote',
    };
  }

  const compile = data.compile && typeof data.compile === 'object' ? data.compile : null;
  const run = data.run && typeof data.run === 'object' ? data.run : null;
  const compileStdout = typeof compile?.stdout === 'string' ? compile.stdout : '';
  const compileStderr = typeof compile?.stderr === 'string' ? compile.stderr : '';

  const compileOutput = truncateOutput(`${compileStdout}${compileStderr}`.trim());

  if (compile && typeof compile.code === 'number' && compile.code !== 0) {
    const line = errorLineFromOutput(compileOutput);
    return {
      status: 'compilation_error',
      stdout: '',
      stderr: '',
      compileOutput,
      message: 'The compiler reported errors. Read the compile output, then try one small change.',
      time: elapsedMs,
      memory: null,
      exitCode: compile.code,
      errorLine: line,
      errorLineConfidence: line ? 'estimated' : 'unknown',
      executionMode: 'secure_remote',
    };
  }

  if (!run) {
    return {
      status: 'unavailable',
      stdout: '',
      stderr: '',
      compileOutput,
      message: typeof data.message === 'string' ? data.message.slice(0, 300) : 'The secure provider returned no result.',
      time: elapsedMs,
      memory: null,
      exitCode: null,
      errorLine: null,
      errorLineConfidence: 'unknown',
      executionMode: 'secure_remote',
    };
  }

  const stdout = truncateOutput(typeof run.stdout === 'string' ? run.stdout : '');
  const stderr = truncateOutput(typeof run.stderr === 'string' ? run.stderr : '');
  const killed = run.signal === 'SIGKILL' || run.signal === 'SIGTERM';
  const exitCode = typeof run.code === 'number' ? run.code : null;

  let status: SecureRunStatus = 'success';
  let message = 'The program finished.';
  if (killed || (exitCode !== null && exitCode !== 0 && /time|kill/i.test(run.signal ?? ''))) {
    status = 'time_limit_exceeded';
    message = `The program exceeded the ${env.runTimeoutMs}ms execution budget and was stopped.`;
  } else if (exitCode !== null && exitCode !== 0) {
    status = 'runtime_error';
    message = 'The program stopped with a runtime error.';
  }

  const line = status === 'runtime_error' ? errorLineFromOutput(stderr) : null;

  return {
    status,
    stdout,
    stderr,
    compileOutput,
    message,
    time: elapsedMs,
    memory: null,
    exitCode,
    errorLine: line,
    errorLineConfidence: line ? 'estimated' : 'unknown',
    executionMode: 'secure_remote',
  };
}
