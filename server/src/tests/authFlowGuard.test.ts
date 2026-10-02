import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Regression guard for the login → logout → login lockout.
 *
 * The credential-stuffing limiter used to cover every `/api/auth` route. The
 * read-only session helpers (`GET /csrf`, `GET /me`) fire on every page load,
 * so ~20 page loads drained the whole 40-per-15-minute budget and a returning
 * learner's correct-password login was rejected with 429 "Too many account
 * requests." until the server restarted. These tests pin the corrected wiring:
 * only the four credential POSTs sit behind the strict budget, and `me()` no
 * longer rotates the CSRF cookie on every call (which could invalidate an open
 * tab's token between read and send).
 */
const indexSource = fs.readFileSync(path.resolve(process.cwd(), 'src/index.ts'), 'utf8');
const routesSource = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/authRoutes.ts'), 'utf8');
const authSource = fs.readFileSync(path.resolve(process.cwd(), 'src/auth/auth.ts'), 'utf8');

test('index never applies a blanket limiter to all of /api/auth', () => {
  assert.doesNotMatch(indexSource, /app\.use\(['"]\/api\/auth['"]/);
});

test('the four credential POSTs carry the strict auth limiter', () => {
  for (const route of ['/register', '/login', '/forgot-password', '/reset-password']) {
    assert.match(routesSource, new RegExp(`authRoutes\\.post\\('${route}', authWriteLimiter`));
  }
});

test('read-only session helpers never consume the credential budget', () => {
  assert.doesNotMatch(routesSource, /authRoutes\.get\('\/csrf', authWriteLimiter/);
  assert.doesNotMatch(routesSource, /authRoutes\.get\('\/me', authWriteLimiter/);
});

test('the who-am-i endpoint no longer rotates the CSRF cookie on every call', () => {
  const meBody = authSource.match(/export function me\(req[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(meBody, 'me() handler found');
  assert.match(meBody, /req\.cookies\?\.codementor_csrf/);
});
