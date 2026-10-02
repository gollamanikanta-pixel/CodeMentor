import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { db } from '../db/database.js';

/**
 * Guards the v2 account/sync schema: every expected table must exist, the
 * schema must never reference a process-execution primitive, and the auth
 * module must hash passwords rather than store them.
 */
const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/db/schema.sql'), 'utf8');

test('schema declares every v2 table', () => {
  for (const table of [
    'AppUser',
    'Session',
    'PasswordResetToken',
    'UserSettings',
    'Project',
    'ProjectFile',
    'ExecutionJob',
    'QuizHistory',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
});

test('schema never embeds a process-execution primitive', () => {
  assert.doesNotMatch(schema, /child_process|execSync|spawn\(/);
});

test('auth stores a password hash, never a plain password column', () => {
  assert.match(schema, /passwordHash TEXT NOT NULL/);
  assert.doesNotMatch(schema, /password TEXT/);
});

test(
  'database connection loads the applied schema tables',
  { skip: !/^postgres(ql)?:/.test(process.env.DATABASE_URL || '') && 'set DATABASE_URL to a Postgres URL to run' },
  async () => {
    const rows = await db
      .prepare("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'")
      .all<{ name: string }>();
    const names = rows.map((row) => row.name);
    assert.ok(names.includes('appuser') && names.includes('projectfile'));
  },
);
