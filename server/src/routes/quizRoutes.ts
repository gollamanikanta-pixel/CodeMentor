import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, now } from '../db/database.js';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/auth.js';

export const quizRoutes = Router();

quizRoutes.use(requireAuth, requireCsrf);

type QuizRow = {
  id: string;
  projectId?: string | null;
  projectName: string | null;
  language: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  percentage: string;
  conceptsToReview: string;
  createdAt: string;
};

/** Maps a joined row to the client `QuizRecord` shape. */
function toRecord(row: QuizRow) {
  let concepts: string[] = [];
  try {
    const parsed = JSON.parse(row.conceptsToReview || '[]');
    if (Array.isArray(parsed)) concepts = parsed.map(String);
  } catch {
    concepts = [];
  }
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    project: row.projectName ?? 'Untitled project',
    language: row.language,
    difficulty: row.difficulty,
    score: Number(row.score),
    total: Number(row.totalQuestions),
    percentage: row.percentage,
    date: row.createdAt,
    conceptsToReview: concepts,
  };
}

const SELECT = `SELECT q.id, q.projectId, q.language, q.difficulty, q.score, q.totalQuestions, q.percentage,
  q.conceptsToReview, q.createdAt, p.title AS projectName
  FROM QuizHistory q LEFT JOIN Project p ON p.id = q.projectId`;

quizRoutes.get('/', async (req: AuthRequest, res) => {
  const rows = await db.prepare(`${SELECT} WHERE q.userId=? ORDER BY q.createdAt DESC`).all<QuizRow>(req.userId!);
  return res.json({ quizzes: rows.map(toRecord) });
});

quizRoutes.post('/', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      project: z.string().trim().min(1).max(120),
      projectId: z.string().uuid().optional(),
      language: z.string().min(1).max(40),
      difficulty: z.string().min(1).max(40),
      score: z.number().int().min(0).max(1000),
      total: z.number().int().min(1).max(1000),
      percentage: z.string().min(1).max(12),
      conceptsToReview: z.array(z.string().max(80)).max(30).default([]),
      quizData: z.unknown().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid quiz record.' });

  // If a project is referenced, it must belong to this learner.
  if (parsed.data.projectId) {
    const owned = await db.prepare('SELECT id FROM Project WHERE id=? AND userId=?').get(parsed.data.projectId, req.userId!);
    if (!owned) return res.status(404).json({ message: 'Project not found.' });
  }

  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO QuizHistory (id,userId,projectId,language,difficulty,score,totalQuestions,percentage,conceptsToReview,quizData,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    id,
    req.userId!,
    parsed.data.projectId || null,
    parsed.data.language,
    parsed.data.difficulty,
    parsed.data.score,
    parsed.data.total,
    parsed.data.percentage,
    JSON.stringify(parsed.data.conceptsToReview),
    parsed.data.quizData === undefined ? null : JSON.stringify(parsed.data.quizData),
    now(),
  );

  const row = await db.prepare(`${SELECT} WHERE q.id=? AND q.userId=?`).get<QuizRow>(id, req.userId!);
  return res.status(201).json({ quiz: toRecord(row!) });
});

quizRoutes.get('/:quizId', async (req: AuthRequest, res) => {
  const row = await db
    .prepare(`${SELECT} WHERE q.id=? AND q.userId=?`)
    .get<QuizRow>(String(req.params.quizId), req.userId!);
  if (!row) return res.status(404).json({ message: 'Quiz record not found.' });
  return res.json({ quiz: toRecord(row) });
});
