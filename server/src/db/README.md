# `server/src/db`

Postgres persistence for account, project, settings, execution and quiz-history
data. `DATABASE_URL` must be a PostgreSQL connection string, including when
running locally.

- `schema.sql` — idempotent table/index/RLS declarations for `AppUser`,
  `Session`, `PasswordResetToken`, `UserSettings`, `Project`, `ProjectFile`,
  `ExecutionJob` and `QuizHistory`.
- `database.ts` — the `pg` pool, async `prepare().get/all/run()` compatibility
  wrapper, parameter conversion, transaction helper and camel-case row mapping.
- `migrate.ts` — applies the schema to the database selected by `DATABASE_URL`;
  run with `npm run db:migrate`.
- `generate.ts` — validates and lists the SQL schema without connecting to a
  database; run with `npm run db:generate`.

No provider credentials are stored in account rows. Account project source and
quiz history are persisted here only through authenticated, owner-scoped API
routes.
