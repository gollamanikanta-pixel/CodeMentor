import crypto from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { db, now } from '../db/database.js';
import { env } from '../config/env.js';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/auth.js';

export const projectRoutes = Router();

// Every project route requires a signed-in owner and a valid CSRF token.
projectRoutes.use(requireAuth, requireCsrf);

const ALLOWED_EXTENSIONS = new Set([
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.java', '.py', '.js', '.mjs',
  '.html', '.htm', '.css', '.ts', '.sql', '.cs', '.go', '.php', '.rb', '.rs',
  '.kt', '.txt',
]);

/** Validates a learner-supplied relative path and returns its normalised form. */
function safePath(input: string) {
  if (!input || input.startsWith('/') || input.includes('\\') || input.split('/').some((part) => !part || part === '..' || part.startsWith('.'))) {
    throw new Error('Unsafe relative path.');
  }
  const normalized = path.posix.normalize(input);
  if (normalized !== input || normalized.includes('..') || normalized.length > 180) {
    throw new Error('Unsafe relative path.');
  }
  const suffix = path.posix.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(suffix)) throw new Error('Unsupported source extension.');
  return { normalized, suffix };
}

type ProjectRow = { id: string; entryFile?: string | null; [key: string]: unknown };

function ownedProject(id: string, userId: string): Promise<ProjectRow | undefined> {
  return db.prepare('SELECT * FROM Project WHERE id=? AND userId=?').get<ProjectRow>(id, userId);
}

projectRoutes.get('/', async (req: AuthRequest, res) =>
  res.json({ projects: await db.prepare('SELECT * FROM Project WHERE userId=? ORDER BY updatedAt DESC').all(req.userId!) }),
);

projectRoutes.post('/', async (req: AuthRequest, res) => {
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120), primaryLanguage: z.string().min(1).max(40), entryFile: z.string().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid project details.' });
  const id = crypto.randomUUID();
  const stamp = now();
  await db.prepare('INSERT INTO Project (id,userId,title,primaryLanguage,entryFile,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(
    id, req.userId!, parsed.data.title, parsed.data.primaryLanguage, parsed.data.entryFile || '', stamp, stamp,
  );
  return res.status(201).json({ project: await db.prepare('SELECT * FROM Project WHERE id=?').get(id) });
});

projectRoutes.get('/:projectId', async (req: AuthRequest, res) => {
  const project = await ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  return res.json({
    project,
    files: await db.prepare('SELECT * FROM ProjectFile WHERE projectId=? ORDER BY relativePath').all(project.id),
  });
});

projectRoutes.put('/:projectId', async (req: AuthRequest, res) => {
  const project = await ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120).optional(), entryFile: z.string().optional(), primaryLanguage: z.string().max(40).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid project update.' });
  await db.prepare('UPDATE Project SET title=COALESCE(?,title),entryFile=COALESCE(?,entryFile),primaryLanguage=COALESCE(?,primaryLanguage),updatedAt=? WHERE id=? AND userId=?').run(
    parsed.data.title || null, parsed.data.entryFile ?? null, parsed.data.primaryLanguage || null, now(), project.id, req.userId!,
  );
  return res.json({ project: await ownedProject(String(project.id), req.userId!) });
});

projectRoutes.delete('/:projectId', async (req: AuthRequest, res) => {
  const result = await db.prepare('DELETE FROM Project WHERE id=? AND userId=?').run(String(req.params.projectId), req.userId!);
  if (!result.changes) return res.status(404).json({ message: 'Project not found.' });
  return res.status(204).end();
});

projectRoutes.post('/:projectId/files', async (req: AuthRequest, res) => {
  const project = await ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const parsed = z
    .object({
      relativePath: z.string(),
      filename: z.string().min(1).max(120),
      language: z.string().min(1).max(40),
      content: z.string().min(1).max(env.executionMaxFileBytes),
      isEntryFile: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid project file.' });

  let safe;
  try {
    safe = safePath(parsed.data.relativePath);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : 'Unsafe path.' });
  }

  const count = (await db.prepare('SELECT COUNT(*) AS count FROM ProjectFile WHERE projectId=?').get<{ count: number }>(project.id))!;
  const total = (await db.prepare('SELECT COALESCE(SUM(length(content)),0) AS total FROM ProjectFile WHERE projectId=?').get<{ total: number }>(project.id))!;
  if (Number(count.count) >= env.executionMaxFiles || Number(total.total) + Buffer.byteLength(parsed.data.content) > env.executionMaxProjectBytes) {
    return res.status(413).json({ message: 'Project file or project size limit reached.' });
  }

  const id = crypto.randomUUID();
  const stamp = now();
  await db.prepare(
    'INSERT INTO ProjectFile (id,projectId,relativePath,filename,extension,language,content,isEntryFile,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).run(id, project.id, safe.normalized, parsed.data.filename, safe.suffix, parsed.data.language, parsed.data.content, parsed.data.isEntryFile ? 1 : 0, stamp, stamp);
  await db.prepare('UPDATE Project SET updatedAt=? WHERE id=?').run(stamp, project.id);
  return res.status(201).json({ file: await db.prepare('SELECT * FROM ProjectFile WHERE id=?').get(id) });
});

projectRoutes.put('/:projectId/files/:fileId', async (req: AuthRequest, res) => {
  const project = await ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const file = await db.prepare('SELECT * FROM ProjectFile WHERE id=? AND projectId=?').get<{ id: string }>(String(req.params.fileId), project.id);
  if (!file) return res.status(404).json({ message: 'File not found.' });
  const parsed = z.object({ content: z.string().min(1).max(env.executionMaxFileBytes), isEntryFile: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid file update.' });
  await db.prepare('UPDATE ProjectFile SET content=?,isEntryFile=COALESCE(?,isEntryFile),updatedAt=? WHERE id=?').run(
    parsed.data.content,
    parsed.data.isEntryFile === undefined ? null : parsed.data.isEntryFile ? 1 : 0,
    now(),
    file.id,
  );
  return res.json({ file: await db.prepare('SELECT * FROM ProjectFile WHERE id=?').get(file.id) });
});

projectRoutes.delete('/:projectId/files/:fileId', async (req: AuthRequest, res) => {
  const project = await ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const result = await db.prepare('DELETE FROM ProjectFile WHERE id=? AND projectId=?').run(String(req.params.fileId), project.id);
  if (!result.changes) return res.status(404).json({ message: 'File not found.' });
  return res.status(204).end();
});
