import { env } from '../config/env.js';
import type { SecureRunStatus } from '../types/index.js';
import { errorLineFromOutput } from './executionErrorLine.js';
import { truncateUtf8 } from './providerResponse.js';

/**
 * Normalizes Judge0 CE's raw submission payload onto CodeMentor's honest result
 * model. Pure functions only: no fetch, no clock, no environment mutation — so
 * the status mapping rules are unit-testable in isolation.
 *
 * Judge0 reports an integer `status.id`; these are the documented CE values
 * (https://ce.judge0.com/#statuses-and-languages-status-get).
 */

export type Judge0Response = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  status?: { id?: number; description?: string } | null;
  time?: string | null;
  memory?: number | null;
  exit_code?: number | null;
};

/** Judge0 status id -> CodeMentor status + a calm, learner-facing message. */
function mapStatus(id: number | undefined, description: string | undefined): { status: SecureRunStatus; message: string } {
  switch (id) {
    case 3:
      return { status: 'success', message: 'The program finished.' };
    case 4:
      // A wrong answer only matters when there is an expected output. In a
      // learning runner there is none, so the program genuinely ran.
      return { status: 'success', message: 'The program finished.' };
    case 5:
      return {
        status: 'time_limit_exceeded',
        message: `The program exceeded the ${env.runTimeoutMs}ms execution budget and was stopped.`,
      };
    case 6:
      return {
        status: 'compilation_error',
        message: 'The compiler reported errors. Read the compile output, then try one small change.',
      };
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return { status: 'runtime_error', message: 'The program stopped with a runtime error.' };
    case 1:
    case 2:
      return { status: 'unavailable', message: 'The secure runner did not finish this run in time.' };
    case 13:
    case 14:
    default:
      return {
        status: 'internal_error',
        message: description ? `The secure runner reported: ${description}.` : 'The secure runner could not complete this run.',
      };
  }
}

function truncateOutput(value: string): string {
  return truncateUtf8(value, env.executionMaxOutputBytes);
}

/** Judge0 returns wall time in seconds as a string ("0.031"); report ms. */
function timeMsFromJudge0(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number.parseFloat(value);
  if (!Number.isFinite(seconds)) return null;
  return Math.max(0, Math.round(seconds * 1000));
}

/** Judge0 reports peak memory in kilobytes; convert to bytes. */
function memoryBytesFromJudge0(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1024);
}

export type NormalizedJudge0Run = {
  status: SecureRunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  time: number | null;
  memory: number | null;
  exitCode: number | null;
  errorLine: number | null;
  errorLineConfidence: 'exact' | 'estimated' | 'unknown';
  executionMode: 'secure_remote';
};

/** Maps one Judge0 submission response body onto the shared result shape. */
export function normalizeJudge0Run(data: Judge0Response, elapsedMs: number): NormalizedJudge0Run {
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

  const statusData = data.status && typeof data.status === 'object' ? data.status : null;
  const statusId = statusData && Number.isSafeInteger(statusData.id) ? statusData.id : undefined;
  const description = typeof statusData?.description === 'string' ? statusData.description.slice(0, 300) : undefined;
  const { status, message } = mapStatus(statusId, description);
  const compileOutput = truncateOutput(typeof data.compile_output === 'string' ? data.compile_output.trim() : '');
  const rawStdout = typeof data.stdout === 'string' ? data.stdout : '';
  const rawStderr = typeof data.stderr === 'string' ? data.stderr : '';

  const stdout = status === 'success' || status === 'runtime_error' ? truncateOutput(rawStdout) : '';
  const stderr = status === 'runtime_error' ? truncateOutput(rawStderr) : '';

  const exitCode = typeof data.exit_code === 'number' && Number.isSafeInteger(data.exit_code) ? data.exit_code : null;
  const diagnostic = `${compileOutput}\n${stderr}`.trim();
  const line = status === 'compilation_error' || status === 'runtime_error' ? errorLineFromOutput(diagnostic) : null;

  return {
    status,
    stdout,
    stderr,
    compileOutput: status === 'compilation_error' ? compileOutput : '',
    message,
    time: timeMsFromJudge0(data.time) ?? elapsedMs,
    memory: memoryBytesFromJudge0(data.memory),
    exitCode,
    errorLine: line,
    errorLineConfidence: line ? 'estimated' : 'unknown',
    executionMode: 'secure_remote',
  };
}
