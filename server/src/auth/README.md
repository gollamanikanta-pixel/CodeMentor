# `server/src/auth`

Session and CSRF handling for the authenticated learning workspace and account storage.

- Passwords are hashed with bcrypt; the schema stores only `passwordHash`.
- Sessions are opaque random tokens stored as SHA-256 hashes with an expiry, sent
  in an httpOnly `SESSION_COOKIE_NAME` cookie.
- A double-submit CSRF cookie (`codementor_csrf`) is issued by `setCsrf` and
  verified by `requireCsrf`, which rejects any state-changing request whose
  `x-csrf-token` header disagrees with the cookie.
- `optionalAuth` attaches the current user when a valid session exists;
  `requireAuth` protects account, project, quiz, settings, AI and execution
  routes that require a signed-in learner.
- Password reset is non-enumerable: `forgot` returns the same response whether or
  not the account exists. In development the reset link is logged, never emailed.

Secrets are read only from `config/env.ts` and never returned to the browser.
