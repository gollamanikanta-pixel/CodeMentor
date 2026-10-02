import fs from 'node:fs';
import path from 'node:path';
import { pool } from './database.js';

/**
 * Applies `schema.sql` to the database in DATABASE_URL. Every statement is
 * idempotent, so running this against an existing database is safe.
 */
const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
await pool.query(fs.readFileSync(schemaPath, 'utf8'));
console.log('CodeMentor Postgres schema is ready.');
await pool.end();
