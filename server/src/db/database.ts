import pg from 'pg';
import { env } from '../config/env.js';

/**
 * Postgres (Supabase) data layer.
 *
 * Call sites keep the shape `db.prepare(sql).get/all/run(...params)` and the
 * `?` placeholder style they had with SQLite, but every call is async. Postgres
 * folds unquoted identifiers to lower case, so result keys are mapped back to
 * the camelCase names the rest of the server (and the client) expect.
 */

// COUNT(*)/SUM() come back as bigint (string) by default; our counts are small.
pg.types.setTypeParser(20, (value) => Number(value));

/** lower-case column name -> camelCase name used in code. */
const CAMEL: Record<string, string> = {};
for (const name of [
  'fullName', 'passwordHash', 'createdAt', 'updatedAt', 'lastLoginAt',
  'userId', 'tokenHash', 'expiresAt', 'userAgent', 'ipMetadata', 'usedAt',
  'fontSize', 'wordWrap', 'reducedMotion', 'explanationLevel', 'hintLevel',
  'defaultLanguage', 'autoVisuals', 'autoQuizReadiness', 'aiDeepHelpEnabled',
  'primaryLanguage', 'entryFile', 'projectId', 'relativePath', 'isEntryFile',
  'sourceSnapshotHash', 'compileOutput', 'providerJobId', 'executionTime',
  'memoryUsage', 'exitCode', 'completedAt', 'failureReason', 'totalQuestions',
  'conceptsToReview', 'quizData',
  // aliases used in SELECTs
  'projectName',
]) {
  CAMEL[name.toLowerCase()] = name;
}

type Row = Record<string, unknown>;

function camelRow<T>(row: Row): T {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) out[CAMEL[key] ?? key] = value;
  return out as T;
}

/** `?` -> `$1, $2, ...` (no query in this codebase has a literal `?`). */
function toPg(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const local = /localhost|127\.0\.0\.1/.test(env.databaseUrl);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  // Serverless functions each open their own pool; keep it tiny and let the
  // Supabase pooler do the multiplexing.
  max: Number(process.env.DATABASE_POOL_MAX || 3),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  ssl: local ? false : { rejectUnauthorized: false },
});
pool.on('error', () => console.error('database pool error'));

type Queryable = Pick<pg.Pool, 'query'>;

class Statement {
  constructor(private readonly target: Queryable, private readonly sql: string) {}

  async get<T = Row>(...params: unknown[]): Promise<T | undefined> {
    const result = await this.target.query(toPg(this.sql), params);
    return result.rows[0] ? camelRow<T>(result.rows[0]) : undefined;
  }

  async all<T = Row>(...params: unknown[]): Promise<T[]> {
    const result = await this.target.query(toPg(this.sql), params);
    return result.rows.map((row) => camelRow<T>(row));
  }

  async run(...params: unknown[]): Promise<{ changes: number }> {
    const result = await this.target.query(toPg(this.sql), params);
    return { changes: result.rowCount ?? 0 };
  }
}

export type Tx = { prepare(sql: string): Statement };

export const db = {
  prepare(sql: string): Statement {
    return new Statement(pool, sql);
  },

  /** Runs `fn` on one connection inside BEGIN/COMMIT (ROLLBACK on error). */
  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn({ prepare: (sql) => new Statement(client, sql) });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },
};

/**
 * The schema lives in Supabase (applied as a migration). Nothing to create at
 * boot; this only verifies the database is reachable so a bad DATABASE_URL
 * fails loudly with a clear message.
 */
export async function ensureSchema(): Promise<void> {
  await pool.query('SELECT 1');
}

/** ISO timestamp helper so every row uses one clock format. */
export function now(): string {
  return new Date().toISOString();
}
