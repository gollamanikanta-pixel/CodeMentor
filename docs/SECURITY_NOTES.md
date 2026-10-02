# CodeMentor security notes

## The one hard rule

This repository **never compiles or runs compiled learner code on the backend**.
There is no `child_process`, `exec`, `spawn`, `fork`, shell command, local
compiler, or Docker execution path anywhere on the server. Compiled languages are
delegated to a vetted remote provider through `SecureExecutionProvider`.

The single intentional exception in the whole project is the **JavaScript browser
worker**, which compiles the learner's code with the `Function` constructor — the
only way to run JavaScript locally. It lives in an isolated worker with no DOM or
network access, never in the React UI, and never on the backend.

## Authentication

- Passwords are hashed with **bcrypt** (cost 12). Only `passwordHash` is stored.
- Sessions are opaque 32-byte random tokens sent in an **httpOnly**,
  `SameSite=Lax` cookie (Secure in production), stored server-side as SHA-256
  hashes with an expiry. Logout deletes the row (server-side invalidation).
- **CSRF**: a double-submit cookie (`codementor_csrf`) must match the
  `x-csrf-token` header on every state-changing request.
- Passwords, tokens, and sessions are never written to `localStorage` or
  `sessionStorage`.

## Ownership

Every project, file, execution, and quiz row is scoped by `userId` in the SQL
query itself (`WHERE id=? AND userId=?`). Frontend checks are convenience only;
the database query is the source of truth.

## Input validation

- Every route validates its body with **Zod**.
- Project file paths are validated by `safePath`: no absolute paths, no
  backslashes, no `.`/`..` segments, extension allowlist, normalized length cap.
- File count, per-file bytes, and per-project bytes are enforced before insert.
- JSON body limit is 512 KB; code and stdin limits mirror the runner limits.

## Transport and headers

- **Helmet** sets a strict Content-Security-Policy and related headers.
- **CORS** is an explicit allowlist from `CLIENT_ORIGIN` with
  `credentials: true` and an `x-csrf-token` allowed header.
- **Rate limits**: a global limiter, a tighter provider limiter for AI/secure
  run, and a dedicated credential limiter (40 per 15 min) on the four
  credential POSTs only — register, login, forgot-password, reset-password.
  The read-only session helpers (`GET /api/auth/csrf`, `GET /api/auth/me`) fire
  on every page load and stay under the global limiter only, so normal browsing
  can never drain the login budget and lock a returning learner out (a 429 on
  correct credentials was the failure mode before this was scoped).
- **CSRF cookies are stable per session**: the who-am-i endpoint issues one
  only when the browser has none, so multiple open tabs never invalidate each
  other's token between read and send.

## Sandboxed preview

- Learner HTML/CSS/JS never enters the parent React DOM (no
  `dangerouslySetInnerHTML` for learner source).
- The preview runs in an iframe with `sandbox="allow-scripts"` — **no**
  `allow-same-origin`, so it cannot read parent cookies, storage, or DOM.
- External resources, remote `<script src>` and `<link href>` are stripped and a
  visible notice explains why.
- The parent accepts `postMessage` only from the active iframe window, only with
  a matching run ID, and renders received text as text only.

## Secrets

- Secrets are read in exactly one place: `server/src/config/env.ts`.
- `.env` and the SQLite database are git-ignored. `.env.example` ships
  placeholders only.
- The frontend never receives an API key. There is no `VITE_AI_API_KEY`,
  `VITE_API_KEY`, or `VITE_AI_MODEL`.
- Errors are logged by short label only — no stack traces, no secret logging.

## Dependency audit

`npm audit` reports **0 vulnerabilities** on a clean `npm install`. Two
transitive advisories used to appear and are pinned at the workspace root via
`overrides` in the root `package.json`:

- `lodash-es` (pulled in by `mermaid` → `chevrotain`): pinned to `^4.18.1`,
  above the vulnerable `<=4.17.23` range. The alternative fix downgraded
  `mermaid` to a breaking major, which is not acceptable.
- `dompurify` (a peer of `monaco-editor`): pinned to `^3.4.16`, above the
  vulnerable `3.4.13 - 3.4.15` range.

Overrides only take effect on a resolution pass; if an old lockfile is present,
run `rm -rf node_modules package-lock.json && npm install` once so the pinned
versions land.

## Reporting

Do not enter passwords, personal information, tokens, database credentials, or
API keys into learning code.
