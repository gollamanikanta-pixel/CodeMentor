# CodeMentor architecture

CodeMentor is an authenticated learning workspace with local-first guidance.
Analysis, visuals and quiz generation run locally, while account-owned projects,
source files, preferences and quiz history use the protected Postgres API.
Playground drafts remain local until explicitly saved.

```
Browser (React + Vite)                         Backend (Express + TS)
────────────────────────                       ──────────────────────
pages/        route screens                    routes/    api composition
layout/       workspace shell                  controllers/  HTTP normalization
editor/       Monaco adapter (themed)          validators/   Zod schemas
analyzers/    local Python/JS/TS/SQL rules     services/     AI response cache
diagrams/     SVG + Mermaid visuals            providers/    secure-runner adapters
quizzes/      local question generation        db/           Postgres schema + client
features/     analysis, visuals, quiz,         auth/         sessions + CSRF
              workspace (multi-file)           middleware/   rate limit + errors
runners/      browser execution contract       config/       the only env reader
workers/      Pyodide + JS Web Workers
storage/      versioned localStorage
web/          sandboxed HTML preview builder
auth/         authenticated account context
api/          the only place that calls the backend
```

## The one invariant

The learning rule is architectural, not cosmetic: **the app never generates
corrected code**. `analyzers/` produces explanations and hints, never a diff or a
replacement; the `Errors & Learning Hints` panel has no "apply fix" control; the
retry button (*"I Fixed It — Run Code Again"*) re-runs the editor buffer unchanged.
A test in `client/tests/localAnalyzer.test.ts` asserts no analysis object ever
carries `correctedCode`, `fixedCode`, `correctedLine`, `applyFix`, `patch` or
`replacement`.

## Local guidance and account data flow

1. The learner types in Monaco. Autosave writes a local draft — no run, no AI.
2. **Run Code** connects to the authenticated interactive runner; HTML preview
   stays in a sandboxed browser iframe.
3. The local analyzer runs in the browser and produces a `LocalAnalysis`.
4. Analysis, visuals and quiz questions are generated locally. On completion,
   a signed-in learner's quiz result is saved through the protected API.
5. **Save project** explicitly sends the Playground source to account storage;
   API failures are shown and never silently saved as local account data.
6. **Ask AI for Deeper Help** is an explicit authenticated request to the
   backend; the account setting and server-only provider configuration are
   checked before a provider is called.

## Accounts, project sync and the multi-file workspace

These account-backed features coexist with local analysis and draft autosave.

- **`server/src/db/`** — Postgres via `pg`. `schema.sql` declares `AppUser`,
  `Session`, `PasswordResetToken`, `UserSettings`, `Project`, `ProjectFile`,
  `ExecutionJob` and `QuizHistory`. `npm run db:migrate` applies the idempotent
  schema to the configured Postgres database; boot verifies database connectivity.
- **`server/src/auth/`** — bcrypt password hashing, opaque session tokens stored
  as SHA-256 hashes, an httpOnly session cookie, and a double-submit CSRF cookie
  (`codementor_csrf`) that every state-changing request must echo in an
  `x-csrf-token` header. Account data routes require authentication.
- **`server/src/routes/projectRoutes.ts`** — owner-scoped project and file CRUD.
  Paths are validated (`safePath`), files are capped per project, and a learner
  can only ever read or write their own rows.
- **Playground and quiz-history flows** — explicit Playground saves persist
  source files through the protected API. Completed signed-in quiz results and
  history are account-backed; failed account requests do not fall back to
  browser-local project/history values.
- **AI Deep Help** — the authenticated route checks the account's saved AI
  preference and calls the configured provider from server-only environment
  variables. Provider credentials and raw configuration never reach the client.
- **`server/src/routes/authRoutes.ts`** — register / login / logout / me / forgot /
  reset, each Zod-validated. Password reset is deliberately non-enumerable.
- **`POST /api/executions`** — authenticated, project-aware execution. It snapshots
  the project's entry file, records a durable `ExecutionJob`, and delegates to the
  same `SecureExecutionProvider` used by `/api/run`. The backend still never
  compiles or runs student code.
- **`server/src/providers/`** — the secure-runner adapter layer. `Judge0ExecutionProvider`
  (default: the keyless Judge0 CE service, all nine compiled languages),
  `PistonExecutionProvider` (keyless Piston alternative), `ResilientExecutionProvider`
  (retries the same unmodified source on Judge0 when Piston refuses to execute),
  `LiveSecureExecutionProvider` (generic URL + key), and
  `UnavailableExecutionProvider` (honest fallback). Each response normalizer is a pure,
  unit-tested function, and one shared guard enforces the daily limit and cooldown for
  every remote provider so public rate limits never surface as the learner's error.
- **`client/src/web/sandboxPreview.ts`** — builds one self-contained HTML document
  from `.html` / `.css` / `.js` files. It blocks external resources and remote
  `<script src>` / `<link href>` tags, and the preview runs in an
  `sandbox="allow-scripts"` iframe so it never shares the app's origin.
- **`client/src/features/workspace/MultiFileWorkspace.tsx`** — a file explorer,
  themed Monaco editor, sandboxed preview with a `postMessage` console bridge,
  ZIP import/export, and save-to-account. It reuses the shared `codementor-dark` /
  `codementor-light` Monaco themes so the workspace matches the Playground.
- **`client/src/auth/AuthContext.tsx`** + **`ProtectedRoute`** — authenticated
  account state. Dashboard, Playground, projects, quiz history, settings, help
  and multi-file workspace require a signed-in learner.

## Security posture

There is no `child_process`, `exec`, `spawn`, shell, local compiler or Docker path
anywhere on the server. The single intentional exception in the whole project is
the **JavaScript browser worker**, which compiles learner code with the `Function`
constructor — the only way to run JavaScript locally — inside an isolated worker
with no DOM or network access. Secrets live only in `server/.env`; the browser
never receives an API key.
