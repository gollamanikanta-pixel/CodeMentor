import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { aiUsage, deepAnalyze } from '../services/aiService.js';
import { executionCapabilities, executionUsage, selectExecutionProvider } from '../providers/index.js';
import { deepAnalyzeSchema, runSchema } from '../validators/requestSchemas.js';
import { db, now } from '../db/database.js';
import type { AuthRequest } from '../auth/auth.js';
import type { DeepAnalyzeInput, SecureRunInput } from '../types/index.js';

export async function postDeepAnalyze(req: Request, res: Response) {
  const parsed = deepAnalyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'The learning context is too large or incomplete.' });
  }
  try {
    const result = await deepAnalyze(parsed.data as DeepAnalyzeInput);
    return res.json(result);
  } catch (error) {
    return res.status(503).json({
      message: error instanceof Error ? error.message : 'Deeper guidance is unavailable.',
    });
  }
}

export function getAiUsage(_req: Request, res: Response) {
  return res.json(aiUsage());
}

export async function postSecureRun(req: Request, res: Response) {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: 'internal_error',
      message: 'Source, input, or language is not valid for secure execution.',
    });
  }
  const provider = selectExecutionProvider(parsed.data.language);
  const input: SecureRunInput = {
    source: parsed.data.source,
    stdin: parsed.data.stdin ?? '',
    language: parsed.data.language,
  };
  return res.json(await provider.run(input));
}

export function getExecutionUsage(_req: Request, res: Response) {
  return res.json(executionUsage());
}

/** Probes the configured runner so the UI can report real readiness. */
export async function getExecutionCapabilities(_req: Request, res: Response) {
  return res.json(await executionCapabilities());
}

const executionSchema = z.object({
  source: z.string().max(51200).optional(),
  stdin: z.string().max(10240).default(''),
  language: z.enum(['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin']),
  projectId: z.string().uuid().optional(),
  entryFile: z.string().max(180).optional(),
});

/**
 * Authenticated project-aware execution. A learner may run either a raw source
 * snapshot or a saved project; the entry file's content is used as the source.
 * A durable ExecutionJob row records the attempt, and the backend never
 * compiles or runs the code itself.
 */
export async function postExecution(req: AuthRequest, res: Response) {
  const parsed = executionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: 'internal_error', message: 'Project, source, input, or language is not valid for secure execution.' });
  }
  if (!parsed.data.projectId && !parsed.data.source) {
    return res.status(400).json({ status: 'internal_error', message: 'A project or source snapshot is required.' });
  }

  let source = parsed.data.source || '';
  let files: { relativePath: string; content: string }[] = [];

  if (parsed.data.projectId) {
    const project = await db
      .prepare('SELECT * FROM Project WHERE id=? AND userId=?')
      .get<{ id: string; entryFile?: string | null }>(parsed.data.projectId, req.userId!);
    if (!project) return res.status(404).json({ status: 'internal_error', message: 'Project not found.' });
    const rows = await db
      .prepare('SELECT relativePath,content FROM ProjectFile WHERE projectId=? ORDER BY relativePath')
      .all<{ relativePath: string; content: string }>(project.id);
    files = rows.map((row) => ({ relativePath: String(row.relativePath), content: String(row.content) }));
    const selected = files.find((file) => file.relativePath === (parsed.data.entryFile || project.entryFile));
    source = selected?.content || source;
  }

  const id = crypto.randomUUID();
  const snapshotHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ source, files, stdin: parsed.data.stdin, language: parsed.data.language }))
    .digest('hex');

  await db.prepare(
    'INSERT INTO ExecutionJob (id,userId,projectId,language,status,sourceSnapshotHash,input,createdAt) VALUES (?,?,?,?,?,?,?,?)',
  ).run(id, req.userId!, parsed.data.projectId || null, parsed.data.language, 'Queued', snapshotHash, parsed.data.stdin, now());

  const provider = selectExecutionProvider(parsed.data.language);
  const input: SecureRunInput = {
    source,
    stdin: parsed.data.stdin,
    language: parsed.data.language,
    files,
    entryFile: parsed.data.entryFile,
    jobId: id,
    userId: req.userId,
  };
  const result = await provider.run(input);

  await db.prepare(
    'UPDATE ExecutionJob SET status=?,stdout=?,stderr=?,compileOutput=?,executionTime=?,memoryUsage=?,exitCode=?,completedAt=?,failureReason=? WHERE id=? AND userId=?',
  ).run(
    result.status,
    result.stdout || '',
    result.stderr || '',
    result.compileOutput || '',
    result.time,
    result.memory,
    result.exitCode,
    now(),
    result.status === 'success' ? '' : result.message,
    id,
    req.userId!,
  );

  return res.json({ ...result, jobId: id });
}

/**
 * Cancellation is provider-dependent. No provider is configured with a cancel
 * API here, so this reports the truth rather than pretending it stopped a job.
 */
export async function cancelExecution(req: AuthRequest, res: Response) {
  const row = await db
    .prepare('SELECT id,status FROM ExecutionJob WHERE id=? AND userId=?')
    .get<{ id: string; status: string }>(String(req.params.jobId), req.userId!);
  if (!row) return res.status(404).json({ message: 'Execution job not found.' });
  const finished = ['success', 'compilation_error', 'runtime_error', 'time_limit_exceeded', 'memory_limit_exceeded', 'internal_error', 'unavailable'];
  if (finished.includes(row.status)) {
    return res.json({ cancelled: false, message: 'This execution has already finished.' });
  }
  return res.json({
    cancelled: false,
    message: 'Cancellation is not supported by the configured secure runner. Local guidance remains available.',
  });
}

/** Read-only lookup of one of the signed-in learner's execution jobs. */
export async function getExecution(req: AuthRequest, res: Response) {
  const row = await db.prepare('SELECT * FROM ExecutionJob WHERE id=? AND userId=?').get(String(req.params.jobId), req.userId!);
  if (!row) return res.status(404).json({ message: 'Execution job not found.' });
  return res.json({ job: row });
}
