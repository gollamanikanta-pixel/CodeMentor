/**
 * Access model.
 *
 * Public routes render on their own, outside the workspace shell.
 * Authenticated routes require a session: an unauthenticated visitor is sent to
 * `/login?next=<safe path>` and returned there after a successful sign-in.
 */
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/404',
] as const;

export const AUTH_ROUTES = [
  '/dashboard',
  '/playground',
  '/workspace',
  '/projects',
  '/quiz-history',
  '/settings',
  '/help',
] as const;

/** Kept for backwards compatibility with earlier imports. */
export const CODEMENTOR_ROUTES = AUTH_ROUTES;

export const FALLBACK_ROUTE = '/404';

/** Narrows an arbitrary `next` value to a safe, in-app, authenticated path. */
export function safeReturnPath(next: string | null): string {
  if (!next) return '/dashboard';
  // Only same-origin absolute paths are accepted — never a protocol or host.
  if (!next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  const allowed = AUTH_ROUTES.some((route) => next === route || next.startsWith(`${route}/`));
  return allowed ? next : '/dashboard';
}
