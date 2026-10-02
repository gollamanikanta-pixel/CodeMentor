import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';

/**
 * Single shared SQLite connection. The path comes from `DATABASE_URL`
 * (`file:./dev.db` by default) and is always resolved to an absolute path so
 * the same database is used no matter which directory the server starts from.
 */
function resolveDatabasePath(value: string): string {
  const file = value.replace(/^file:/, '');
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
}

const dbPath = resolveDatabasePath(env.databaseUrl);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

/**
 * Applies `schema.sql` (idempotent — every statement is `IF NOT EXISTS`).
 * Called at startup so a fresh checkout works without a manual migrate step,
 * and also by the `db:migrate` script.
 */
export function ensureSchema(): void {
  const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
}

/** ISO timestamp helper so every row uses one clock format. */
export function now(): string {
  return new Date().toISOString();
}

export { dbPath };
