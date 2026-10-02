import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { db, now } from '../db/database.js';
import { env } from '../config/env.js';

export type SafeUser = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string | null;
};

export type AuthRequest = Request & { user?: SafeUser; userId?: string };

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const safeUser = (row: Record<string, unknown>): SafeUser => ({
  id: String(row.id),
  fullName: String(row.fullName),
  email: String(row.email),
  createdAt: String(row.createdAt),
  lastLoginAt: (row.lastLoginAt as string | null) ?? null,
});

const secure = () => env.nodeEnv === 'production';

/** Resolves a session cookie for authenticated non-HTTP transports (WebSocket). */
export async function authenticateSessionCookie(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  const row = await db
    .prepare('SELECT userId FROM Session WHERE tokenHash=? AND expiresAt>?')
    .get<{ userId: string }>(hash(raw), now());
  return row?.userId ?? null;
}

/** Issues a double-submit CSRF cookie the browser echoes back in a header. */
export function setCsrf(res: Response): string {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie('codementor_csrf', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: secure(),
    maxAge: env.sessionTtlDays * 86_400_000,
    path: '/',
  });
  return token;
}

/** Rejects state-changing requests whose CSRF header and cookie disagree. */
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = req.cookies?.codementor_csrf;
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ message: 'Security check failed. Refresh and try again.' });
  }
  return next();
}

export async function createSession(res: Response, userId: string, req: Request, remember = true) {
  const raw = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + (remember ? env.sessionTtlDays : 1) * 86_400_000).toISOString();
  await db.prepare(
    'INSERT INTO Session (id,userId,tokenHash,expiresAt,createdAt,userAgent,ipMetadata) VALUES (?,?,?,?,?,?,?)',
  ).run(
    crypto.randomUUID(),
    userId,
    hash(raw),
    expires,
    now(),
    req.get('user-agent')?.slice(0, 200) || null,
    req.ip?.slice(0, 100) || null,
  );
  res.cookie(env.sessionCookieName, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    expires: new Date(expires),
    path: '/',
  });
  setCsrf(res);
}

export async function destroySession(req: Request, res: Response) {
  const raw = req.cookies?.[env.sessionCookieName];
  if (raw) await db.prepare('DELETE FROM Session WHERE tokenHash=?').run(hash(raw));
  res.clearCookie(env.sessionCookieName, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/' });
  res.clearCookie('codementor_csrf', { sameSite: 'lax', secure: secure(), path: '/' });
}

/** Attaches the current user when a valid session cookie is present. */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const raw = req.cookies?.[env.sessionCookieName];
  if (raw) {
    try {
    const row = await db
      .prepare('SELECT AppUser.* FROM Session JOIN AppUser ON AppUser.id=Session.userId WHERE Session.tokenHash=? AND Session.expiresAt>?')
      .get(hash(raw), now());
    if (row) {
      req.user = safeUser(row);
      req.userId = String(row.id);
    }
    } catch (error) {
      return next(error);
    }
  }
  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ message: 'Authentication required.' });
  return next();
}

export async function register(
  input: { fullName: string; email: string; password: string },
  req: Request,
  res: Response,
) {
  const email = input.email.trim().toLowerCase();
  const exists = await db.prepare('SELECT id FROM AppUser WHERE email=?').get(email);
  if (exists) return res.status(409).json({ message: 'An account with that email already exists.' });

  const id = crypto.randomUUID();
  const timestamp = now();
  const passwordHash = await bcrypt.hash(input.password, 12);

  await db.transaction(async (tx) => {
    await tx.prepare('INSERT INTO AppUser (id,fullName,email,passwordHash,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run(
      id,
      input.fullName.trim(),
      email,
      passwordHash,
      timestamp,
      timestamp,
    );
    await tx.prepare('INSERT INTO UserSettings (id,userId,updatedAt) VALUES (?,?,?)').run(crypto.randomUUID(), id, timestamp);
  });
  await createSession(res, id, req);
  const created = await db.prepare('SELECT * FROM AppUser WHERE id=?').get(id);
  return res.status(201).json({ user: safeUser(created as Record<string, unknown>) });
}

export async function login(
  input: { email: string; password: string; remember?: boolean },
  req: Request,
  res: Response,
) {
  const row = await db
    .prepare('SELECT * FROM AppUser WHERE email=?')
    .get<{ id: string; passwordHash: string; [key: string]: unknown }>(input.email.trim().toLowerCase());
  const valid = row ? await bcrypt.compare(input.password, row.passwordHash) : false;
  if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

  const stamp = now();
  await db.prepare('UPDATE AppUser SET lastLoginAt=?,updatedAt=? WHERE id=?').run(stamp, stamp, row!.id);
  await createSession(res, row!.id, req, input.remember !== false);
  return res.json({ user: safeUser({ ...row!, lastLoginAt: stamp }) });
}

export async function logout(req: Request, res: Response) {
  await destroySession(req, res);
  return res.status(204).end();
}

export function me(req: AuthRequest, res: Response) {
  // Always 200: "who am I" is a normal question for a signed-out visitor, and
  // answering with 401 would log a console error on every anonymous page load.
  // Issue a CSRF cookie only when the browser has none: rotating it here on
  // every page load races other open tabs (their next state-changing POST reads
  // a cookie that has since been replaced) and wastes a token per load. The
  // client fetches a fresh token itself when it needs one.
  if (!req.cookies?.codementor_csrf) setCsrf(res);
  return res.json({ user: req.user ?? null });
}

/**
 * Always responds with the same message so account existence is never leaked.
 * In development the reset link is logged instead of emailed.
 */
export async function forgot(email: string, _req: Request, res: Response) {
  const row = await db.prepare('SELECT id FROM AppUser WHERE email=?').get<{ id: string }>(email.trim().toLowerCase());
  if (row) {
    const raw = crypto.randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO PasswordResetToken (id,userId,tokenHash,expiresAt,createdAt) VALUES (?,?,?,?,?)').run(
      crypto.randomUUID(),
      row.id,
      hash(raw),
      new Date(Date.now() + 3_600_000).toISOString(),
      now(),
    );
    if (env.nodeEnv !== 'production') {
      console.log(`CodeMentor development reset link: ${env.clientOrigin}/reset-password?token=${raw}`);
    }
  }
  return res.json({ message: 'If an account exists for that email, password reset instructions have been prepared.' });
}

export async function reset(token: string, password: string, res: Response) {
  const row = await db
    .prepare('SELECT * FROM PasswordResetToken WHERE tokenHash=? AND usedAt IS NULL AND expiresAt>?')
    .get<{ id: string; userId: string }>(hash(token), now());
  if (!row) return res.status(400).json({ message: 'This reset link is invalid or expired.' });

  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE AppUser SET passwordHash=?,updatedAt=? WHERE id=?').run(passwordHash, now(), row.userId);
    await tx.prepare('UPDATE PasswordResetToken SET usedAt=? WHERE id=?').run(now(), row.id);
    await tx.prepare('DELETE FROM Session WHERE userId=?').run(row.userId);
  });
  return res.json({ message: 'Password reset successfully. You can now log in.' });
}
