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

function ownedProject(id: string, userId: string): ProjectRow | undefined {
  return db.prepare('SELECT * FROM Project WHERE id=? AND userId=?').get(id, userId) as ProjectRow | undefined;
}

projectRoutes.get('/', (req: AuthRequest, res) =>
  res.json({ projects: db.prepare('SELECT * FROM Project WHERE userId=? ORDER BY updatedAt DESC').all(req.userId!) }),
);

projectRoutes.post('/', (req: AuthRequest, res) => {
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120), primaryLanguage: z.string().min(1).max(40), entryFile: z.string().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid project details.' });
  const id = crypto.randomUUID();
  const stamp = now();
  db.prepare('INSERT INTO Project (id,userId,title,primaryLanguage,entryFile,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(
    id, req.userId!, parsed.data.title, parsed.data.primaryLanguage, parsed.data.entryFile || '', stamp, stamp,
  );
  return res.status(201).json({ project: db.prepare('SELECT * FROM Project WHERE id=?').get(id) });
});

projectRoutes.get('/:projectId', (req: AuthRequest, res) => {
  const project = ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  return res.json({
    project,
    files: db.prepare('SELECT * FROM ProjectFile WHERE projectId=? ORDER BY relativePath').all(project.id),
  });
});

projectRoutes.put('/:projectId', (req: AuthRequest, res) => {
  const project = ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const parsed = z
    .object({ title: z.string().trim().min(1).max(120).optional(), entryFile: z.string().optional(), primaryLanguage: z.string().max(40).optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid project update.' });
  db.prepare('UPDATE Project SET title=COALESCE(?,title),entryFile=COALESCE(?,entryFile),primaryLanguage=COALESCE(?,primaryLanguage),updatedAt=? WHERE id=? AND userId=?').run(
    parsed.data.title || '', parsed.data.entryFile || '', parsed.data.primaryLanguage || '', now(), project.id, req.userId!,
  );
  return res.json({ project: ownedProject(String(project.id), req.userId!) });
});

projectRoutes.delete('/:projectId', (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM Project WHERE id=? AND userId=?').run(String(req.params.projectId), req.userId!);
  if (!result.changes) return res.status(404).json({ message: 'Project not found.' });
  return res.status(204).end();
});

projectRoutes.post('/:projectId/files', (req: AuthRequest, res) => {
  const project = ownedProject(String(req.params.projectId), req.userId!);
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

  const count = db.prepare('SELECT COUNT(*) count FROM ProjectFile WHERE projectId=?').get(project.id) as { count: number };
  const total = db.prepare('SELECT COALESCE(SUM(length(content)),0) total FROM ProjectFile WHERE projectId=?').get(project.id) as { total: number };
  if (Number(count.count) >= env.executionMaxFiles || Number(total.total) + Buffer.byteLength(parsed.data.content) > env.executionMaxProjectBytes) {
    return res.status(413).json({ message: 'Project file or project size limit reached.' });
  }

  const id = crypto.randomUUID();
  const stamp = now();
  db.prepare(
    'INSERT INTO ProjectFile (id,projectId,relativePath,filename,extension,language,content,isEntryFile,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).run(id, project.id, safe.normalized, parsed.data.filename, safe.suffix, parsed.data.language, parsed.data.content, parsed.data.isEntryFile ? 1 : 0, stamp, stamp);
  db.prepare('UPDATE Project SET updatedAt=? WHERE id=?').run(stamp, project.id);
  return res.status(201).json({ file: db.prepare('SELECT * FROM ProjectFile WHERE id=?').get(id) });
});

projectRoutes.put('/:projectId/files/:fileId', (req: AuthRequest, res) => {
  const project = ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const file = db.prepare('SELECT * FROM ProjectFile WHERE id=? AND projectId=?').get(String(req.params.fileId), project.id) as { id: string } | undefined;
  if (!file) return res.status(404).json({ message: 'File not found.' });
  const parsed = z.object({ content: z.string().min(1).max(env.executionMaxFileBytes), isEntryFile: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid file update.' });
  db.prepare('UPDATE ProjectFile SET content=?,isEntryFile=COALESCE(?,isEntryFile),updatedAt=? WHERE id=?').run(
    parsed.data.content,
    parsed.data.isEntryFile === undefined ? null : parsed.data.isEntryFile ? 1 : 0,
    now(),
    file.id,
  );
  return res.json({ file: db.prepare('SELECT * FROM ProjectFile WHERE id=?').get(file.id) });
});

projectRoutes.delete('/:projectId/files/:fileId', (req: AuthRequest, res) => {
  const project = ownedProject(String(req.params.projectId), req.userId!);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  const result = db.prepare('DELETE FROM ProjectFile WHERE id=? AND projectId=?').run(String(req.params.fileId), project.id);
  if (!result.changes) return res.status(404).json({ message: 'File not found.' });
  return res.status(204).end();
});
