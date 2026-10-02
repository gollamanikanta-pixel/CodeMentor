import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, now } from '../db/database.js';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/auth.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth, requireCsrf);

type SettingsRow = {
  theme: string;
  fontSize: number;
  wordWrap: number;
  minimap: number;
  reducedMotion: number;
  explanationLevel: string;
  hintLevel: string;
  defaultLanguage: string;
  autoVisuals: number;
  autoQuizReadiness: number;
  autosave: number;
  aiDeepHelpEnabled: number;
};

/** Server columns → the client `CodeMentorSettings` shape. */
function toSettings(row: SettingsRow) {
  return {
    theme: row.theme,
    fontSize: Number(row.fontSize),
    wordWrap: Boolean(row.wordWrap),
    minimap: Boolean(row.minimap),
    reducedMotion: Boolean(row.reducedMotion),
    explanationLevel: row.explanationLevel,
    hintLevel: row.hintLevel,
    defaultLanguage: row.defaultLanguage,
    automaticVisuals: Boolean(row.autoVisuals),
    automaticQuizReadiness: Boolean(row.autoQuizReadiness),
    autosave: Boolean(row.autosave),
    aiDeepHelp: Boolean(row.aiDeepHelpEnabled),
  };
}

/** Ensures the learner always has a settings row to read and update. */
async function ensureRow(userId: string): Promise<SettingsRow> {
  const existing = await db.prepare('SELECT * FROM UserSettings WHERE userId=?').get<SettingsRow>(userId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO UserSettings (id,userId,updatedAt) VALUES (?,?,?)').run(id, userId, now());
  return (await db.prepare('SELECT * FROM UserSettings WHERE userId=?').get<SettingsRow>(userId))!;
}

settingsRoutes.get('/', async (req: AuthRequest, res) => res.json({ settings: toSettings(await ensureRow(req.userId!)) }));

settingsRoutes.put('/', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      theme: z.enum(['dark', 'light', 'system']).optional(),
      fontSize: z.number().int().min(10).max(28).optional(),
      wordWrap: z.boolean().optional(),
      minimap: z.boolean().optional(),
      reducedMotion: z.boolean().optional(),
      explanationLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
      hintLevel: z.enum(['Gentle', 'Guided', 'Learning']).optional(),
      defaultLanguage: z.string().min(1).max(40).optional(),
      automaticVisuals: z.boolean().optional(),
      automaticQuizReadiness: z.boolean().optional(),
      autosave: z.boolean().optional(),
      aiDeepHelp: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid settings update.' });

  await ensureRow(req.userId!);
  const bit = (value: boolean | undefined) => (value === undefined ? null : value ? 1 : 0);

  await db.prepare(
    `UPDATE UserSettings SET
      theme=COALESCE(?,theme),
      fontSize=COALESCE(?,fontSize),
      wordWrap=COALESCE(?,wordWrap),
      minimap=COALESCE(?,minimap),
      reducedMotion=COALESCE(?,reducedMotion),
      explanationLevel=COALESCE(?,explanationLevel),
      hintLevel=COALESCE(?,hintLevel),
      defaultLanguage=COALESCE(?,defaultLanguage),
      autoVisuals=COALESCE(?,autoVisuals),
      autoQuizReadiness=COALESCE(?,autoQuizReadiness),
      autosave=COALESCE(?,autosave),
      aiDeepHelpEnabled=COALESCE(?,aiDeepHelpEnabled),
      updatedAt=?
     WHERE userId=?`,
  ).run(
    parsed.data.theme ?? null,
    parsed.data.fontSize ?? null,
    bit(parsed.data.wordWrap),
    bit(parsed.data.minimap),
    bit(parsed.data.reducedMotion),
    parsed.data.explanationLevel ?? null,
    parsed.data.hintLevel ?? null,
    parsed.data.defaultLanguage ?? null,
    bit(parsed.data.automaticVisuals),
    bit(parsed.data.automaticQuizReadiness),
    bit(parsed.data.autosave),
    bit(parsed.data.aiDeepHelp),
    now(),
    req.userId!,
  );

  return res.json({ settings: toSettings(await ensureRow(req.userId!)) });
});
