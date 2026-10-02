import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSandboxDocument, injectIntoHead } from '../src/web/sandboxPreview';

test('buildSandboxDocument keeps a well-formed document intact', () => {
  const html = buildSandboxDocument(
    [{ relativePath: 'index.html', content: '<!doctype html><html><head></head><body>hi</body></html>' }],
    'index.html',
  );
  assert.match(html, /<!doctype html>/);
  assert.match(html, /hi/);
  assert.match(html, /codementor-preview-notice/);
});

test('buildSandboxDocument inlines css and js files for head-less documents', () => {
  const html = buildSandboxDocument(
    [
      { relativePath: 'index.html', content: '<body><main>x</main></body>' },
      { relativePath: 'style.css', content: 'p { color: red; }' },
      { relativePath: 'app.js', content: 'console.log("from file");' },
    ],
    'index.html',
  );
  assert.match(html, /p \{ color: red; \}/);
  assert.match(html, /console\.log\("from file"\);/);
  assert.match(html, /codementor-preview-notice/);
});

test('buildSandboxDocument strips external resources', () => {
  const html = buildSandboxDocument(
    [
      {
        relativePath: 'index.html',
        content:
          '<body><link rel="stylesheet" href="https://cdn.example.com/x.css"><img src="https://example.com/a.png" alt="a"><script src="https://example.com/x.js"></script></body>',
      },
    ],
    'index.html',
  );
  assert.doesNotMatch(html, /example\.com/);
  assert.match(html, /#blocked-external-resource/);
});

test('injectIntoHead places the snippet before visible content in every document shape', () => {
  const withHead = injectIntoHead('<!doctype html><html><head></head><body>x</body></html>', '<script>A</script>');
  assert.match(withHead, /<head><script>A<\/script><\/head>/);

  const noHead = injectIntoHead('<!doctype html><html><body>x</body></html>', '<script>A</script>');
  assert.match(noHead, /<body[^>]*><script>A<\/script>x<\/body>/);

  const bodyOnly = injectIntoHead('<body><p>x</p></body>', '<script>A</script>');
  assert.match(bodyOnly, /<body><script>A<\/script><p>x<\/p><\/body>/);

  const bare = injectIntoHead('just text', '<script>A</script>');
  assert.equal(bare, '<script>A</script>just text');
});

test('buildSandboxDocument rejects unsafe paths and missing entries', () => {
  assert.throws(() => buildSandboxDocument([{ relativePath: '../escape.html', content: 'x' }], 'index.html'));
  assert.throws(() => buildSandboxDocument([{ relativePath: 'other.html', content: 'x' }], 'index.html'));
  assert.throws(() => buildSandboxDocument([{ relativePath: 'app.js', content: 'x' }], 'index.html'));
});
