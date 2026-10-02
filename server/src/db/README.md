# `server/src/db`

SQLite persistence for the optional v2 account features.

- `schema.sql` — every table, all `CREATE TABLE IF NOT EXISTS`. `User`, `Session`,
  `PasswordResetToken`, `UserSettings`, `Project`, `ProjectFile`, `ExecutionJob`
  and `QuizHistory`.
- `database.ts` — a single shared `node:sqlite` `DatabaseSync` connection resolved
  from `DATABASE_URL` (default `file:./data/codementor.db`). Also exports
  `ensureSchema()` and `now()`.
- `migrate.ts` — applies the schema and exits; run with `npm run db:migrate`.

No learner code and no secrets are ever stored here.
