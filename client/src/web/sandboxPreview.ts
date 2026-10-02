/**
 * Builds a single self-contained HTML document for the sandboxed preview.
 *
 * Honest constraints: only `.html`, `.htm`, `.css` and `.js` files are allowed,
 * every path is validated, and all external resources (http/https URLs, remote
 * `<script src>` and `<link href>`) are stripped. If a learner truly needs an
 * external asset they are told it is blocked rather than silently failing.
 */

export type PreviewFile = { relativePath: string; content: string };

const SAFE_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js']);

export const PREVIEW_BLOCKED_MESSAGE =
  'External resources are blocked in the learning preview to protect your workspace. Use files included in this project or write HTML, CSS, and JavaScript directly in the editor.';

/** The iframe runs scripts but never shares the app's origin. */
export const PREVIEW_IFRAME_SANDBOX = 'allow-scripts';

function safePath(value: string): string {
  if (
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((part) => part === '..' || part.startsWith('.'))
  ) {
    throw new Error('Unsafe preview path.');
  }
  const extension = value.slice(value.lastIndexOf('.')).toLowerCase();
  if (!SAFE_EXTENSIONS.has(extension)) throw new Error('Unsupported preview file type.');
  return value;
}

/** Prevents inline content from prematurely closing its own tag. */
function escapeClosingTag(content: string, tag: string): string {
  return content.split(`</${tag}`).join(`<\\/${tag}`);
}

/**
 * Inserts a snippet into the document head. Learner pages are often written
 * without a `<head>` (or even without `<body>`), so every fallback keeps the
 * preview working instead of silently dropping the snippet.
 */
export function injectIntoHead(html: string, snippet: string): string {
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${snippet}</head>`);
  const bodyOpen = /<body[^>]*>/i.exec(html);
  if (bodyOpen) return html.replace(bodyOpen[0], `${bodyOpen[0]}${snippet}`);
  return `${snippet}${html}`;
}

/** Inserts a snippet at the end of the body, wherever the document ends. */
export function injectBeforeBodyEnd(html: string, snippet: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${snippet}</body>`);
  return `${html}${snippet}`;
}

export function buildSandboxDocument(files: PreviewFile[], entryFile = 'index.html'): string {
  const clean = files.map((file) => ({ ...file, relativePath: safePath(file.relativePath) }));
  const entry = clean.find((file) => file.relativePath === entryFile);
  if (!entry) throw new Error('Select an HTML entry file before previewing.');

  const css = clean
    .filter((file) => file.relativePath.endsWith('.css'))
    .map((file) => `<style data-codementor-file="${file.relativePath}">${escapeClosingTag(file.content, 'style')}</style>`)
    .join('');

  const scripts = clean
    .filter((file) => file.relativePath.endsWith('.js'))
    .map((file) => `<script data-codementor-file="${file.relativePath}">${escapeClosingTag(file.content, 'script')}</script>`)
    .join('');

  const scriptTags = /<script[^>]*src=["'][^"']+["'][^>]*>[\s\S]*?<\/script>/gi;
  const linkTags = /<link[^>]+href=["'][^"']+["'][^>]*>/gi;

  let html = entry.content
    .replace(scriptTags, '')
    .replace(linkTags, '')
    .replace(/https?:\/\/[^"' )>]+/gi, '#blocked-external-resource');

  html = injectIntoHead(html, css);
  html = injectBeforeBodyEnd(
    html,
    `${scripts}<div id="codementor-preview-notice" style="font:12px system-ui;color:#64748b;padding:8px">${PREVIEW_BLOCKED_MESSAGE}</div>`,
  );

  return html;
}
