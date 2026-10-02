/** Shared server-side types. No secret values ever live here. */

export type AiUsageSnapshot = {
  configured: boolean;
};

export type ExecutionUsageSnapshot = {
  remaining: number;
  limit: number;
  configured: boolean;
  cooldownSeconds: number;
  enabledLanguages: string[];
};

export type SecureRunStatus =
  | 'success'
  | 'compilation_error'
  | 'runtime_error'
  | 'time_limit_exceeded'
  | 'memory_limit_exceeded'
  | 'internal_error'
  | 'unavailable';

export type SecureRunFile = { relativePath: string; content: string };

export type SecureRunInput = {
  source: string;
  stdin: string;
  language: string;
  /** Optional multi-file snapshot for project-based runs. */
  files?: SecureRunFile[];
  entryFile?: string;
  jobId?: string;
  userId?: string;
};

export type SecureRunResult = {
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

export type DeepAnalyzeInput = {
  source: string;
  language: string;
  execution?: Record<string, unknown> | null;
  localAnalysis?: Record<string, unknown>;
  explanationLevel?: string;
  hintLevel?: string;
  sections?: string[];
};
