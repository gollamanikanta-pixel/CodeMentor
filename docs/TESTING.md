# CodeMentor testing

## Automated tests

The project uses Node's built-in test runner through `tsx`, so no extra test
framework needs to be installed.

```powershell
npm test          # server, client and runner suites
npm test --prefix client
npm test --prefix server
npm test --prefix runner
npm run check     # client and server TypeScript checks
npm run build     # production client build
npm run db:generate # validate Postgres schema
```

### What is covered

| File | Focus |
| --- | --- |
| `client/tests/localAnalyzer.test.ts` | Python literal division by zero, unmatched brackets, runtime traceback mapping, noisy-traceback summarisation, JavaScript loose-equality hint, TypeScript `any` hint, SQL missing `FROM`, unfiltered `DELETE`, "no corrected code" guarantee, diagram selection for loops and functions. |
| `client/tests/localQuiz.test.ts` | Question count is honoured, every question has exactly one valid correct index, questions never contain corrected-code artefacts, generation works without prior analysis. |
| `client/tests/htmlAnalyzer.test.ts` | HTML analyzer rules (missing alt, duplicate ids, unlabelled inputs, blocked external resources, structure hints) with the same no-correction guarantee. |
| `client/tests/sandboxPreview.test.ts` | Sandbox document building for well-formed and head-less documents, CSS/JS inlining, external-resource stripping, unsafe-path and missing-entry rejection, and `injectIntoHead` fallbacks for every document shape. |
| `client/tests/visualDetails.test.ts` | Per-program diagram labels (loop variable, function name) differ between programs, structural analysis covers every compiled language, and a C compile error becomes a learning error with no fix. |
| `client/tests/programFlow.test.ts` | The control-flow parser reads real statements (skipping imports/directives), owns loop/branch bodies, inlines `main`, and renders *distinct* Mermaid flows per program (loops draw a back-edge, branches draw a labelled diamond) with no injected markup. |
| `client/tests/interactiveRunner.test.ts` | Available languages and coming-soon options stay in sync; coming-soon languages cannot be used as interactive runners or defaults. |
| `runner/src/*.test.mjs` | Runner health/configuration, authenticated WebSocket protocol handling, input/output handling and source-line diagnostics. |
| `server/src/utils/hash.test.ts` | `stableStringify` key-order independence, deterministic `stableHash`, hash sensitivity to source changes, `truncate` behaviour. |
| `server/src/tests/auth.test.ts` | The v2 schema declares every account/sync table, embeds no process-execution primitive, stores a password hash (never a plain password column), and the live connection exposes the applied tables. |
| `server/src/tests/providers.test.ts` | Backend secure-runner language mappings resolve to real Piston language ids, learner filenames are preserved with per-language fallbacks, and the provider factory never routes an unmapped language to the remote runner. |
| `server/src/tests/pistonNormalizer.test.ts` | Piston payloads map to honest statuses (success, runtime_error, time_limit_exceeded, compilation_error), error lines are only claimed for line-anchored output, and neither the schema nor any provider imports a process-execution primitive. |
| `server/src/tests/judge0Normalizer.test.ts` | Judge0 CE payloads map to the same honest statuses (Accepted → success, Wrong Answer → success, Compilation Error → compilation_error with the reported line, TLE, SIGSEGV runtimes, Internal Error), seconds → ms and KB → bytes are converted, nothing is invented for an unknown status, and all nine compiled languages map to a Judge0 language id. |
| `server/src/tests/pathSafety.test.ts` | Safe relative paths are accepted; traversal, absolute, hidden, unsupported and executable paths are rejected. |
| `server/src/tests/validatorsAndCache.test.ts` | Run/deep-help Zod contracts (limits, defaults, rejected languages/sections), `TtlCache` expiry, order-independent cache keys and the AI excerpt budget. |
| `server/src/tests/aiService.test.ts` | Provider response parsing/shape validation and account preference defaults/disable behavior for Deep Help. |
| `server/src/tests/settingsRoutes.test.ts` | Account settings accept the client preference names for AI/learning toggles and never accept provider credentials as account settings. |

### Verifying the v2 backend manually

The account, project and execution routes can be exercised without a browser:

```powershell
curl http://localhost:5000/api/health                                    # { ok: true, ... }
curl -i http://localhost:5000/api/auth/csrf                             # sets codementor_csrf, returns a token
curl -o NUL -w "%{http_code}" http://localhost:5000/api/projects        # 401 without a session
```

A state-changing request (register, save project, run execution) must send the
CSRF cookie value back in an `x-csrf-token` header, and a project file path such
as `../evil.js` must be rejected with `Unsafe relative path.`

For account-data flows, verify a signed-in Playground save creates a project
and source file through `/api/projects`, reopening it loads that source, and a
completed quiz appears in `/api/quizzes`. If either API is unavailable, the UI
must report the account-storage error rather than showing browser-local data as
synced. Toggle **Enable AI Deep Help** off in account settings and confirm the
authenticated `/api/deep-analyze` request is rejected by the server; provider
credentials must remain in server environment configuration only.

### What is not yet automated

Live provider execution, worker timeout behaviour and the full UI need a browser
harness (the pure normalization, mapping and quota functions those flows depend
on are covered above). Until Vitest + Playwright are added, use
[`MANUAL_TEST_CHECKLIST.md`](MANUAL_TEST_CHECKLIST.md), including the recorded
arbitrary-code audit in README §16.

## Adding a test

1. Create `client/tests/<name>.test.ts` or `server/src/**/<name>.test.ts`.
2. Import only pure modules (analyzers, quizzes, utils) — never React components
   or DOM APIs, since tests run in Node.
3. Add the file to the matching `test` script in `client/package.json` or
   `server/package.json`.
4. Run `npm test`.

Client tests live in `client/tests/` (outside `src/`) on purpose so the app's
`tsconfig` does not need Node type definitions.
