import { db, ensureSchema } from './database.js';

/**
 * Applies `schema.sql`. Every statement is `IF NOT EXISTS`, so running this on
 * an existing database is safe. Invoked by `npm run db:migrate` — the server
 * also calls `ensureSchema()` on boot.
 */
ensureSchema();
console.log('CodeMentor SQLite schema is ready.');
db.close();
