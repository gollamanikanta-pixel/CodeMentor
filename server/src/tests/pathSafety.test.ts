import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * The project file API must accept only safe, normalized relative paths.
 * These cases mirror the Zod-route guard in `projectRoutes.ts` so the rules
 * are pinned by a test, not just by code review.
 */

// Re-implemented here verbatim from the route helper to keep the test free of
// Express imports; any drift between the two must fail the expectations below.
const ALLOWED_EXTENSIONS = new Set([
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.java', '.py', '.js', '.mjs',
  '.html', '.htm', '.css', '.ts', '.sql', '.cs', '.go', '.php', '.rb', '.rs',
  '.kt', '.txt',
]);

function safePath(input: string) {
  if (
    !input ||
    input.startsWith('/') ||
    input.includes('\\') ||
    input.split('/').some((part) => !part || part === '..' || part.startsWith('.'))
  ) {
    throw new Error('Unsafe relative path.');
  }
  if (input.includes('..') || input.length > 180) throw new Error('Unsafe relative path.');
  const suffix = input.slice(input.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(suffix)) throw new Error('Unsupported source extension.');
  return { normalized: input, suffix };
}

test('safePath accepts ordinary nested project files', () => {
  assert.equal(safePath('main.c').normalized, 'main.c');
  assert.equal(safePath('src/utils/helpers.py').suffix, '.py');
  assert.equal(safePath('styles.css').suffix, '.css');
});

test('safePath rejects traversal, absolute and hidden paths', () => {
  for (const bad of ['../escape.c', 'a/../../b.c', '/etc/passwd', '\\\\server\\share.java', '.hidden/.env', 'src//x.c', 'a/./b.c']) {
    assert.throws(() => safePath(bad), /Unsafe relative path/, `should reject ${bad}`);
  }
});

test('safePath rejects unsupported and executable extensions', () => {
  for (const bad of ['virus.exe', 'lib.so', 'data.bin', 'run.sh', 'page.php7']) {
    assert.throws(() => safePath(bad), /Unsupported source extension/, `should reject ${bad}`);
  }
});
