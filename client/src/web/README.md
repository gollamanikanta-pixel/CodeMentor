# `client/src/web`

`sandboxPreview.ts` builds a single self-contained HTML document from a project's
`.html`, `.htm`, `.css` and `.js` files for the multi-file workspace preview.

Guarantees:

- Every path is validated (no absolute paths, backslashes, `..` or dotfiles).
- Unsupported file types are rejected rather than guessed.
- External resources are blocked: remote `https?://` URLs, `<script src>` and
  `<link href>` tags are stripped, and the learner sees an explicit notice rather
  than a silently broken page.
- Inline content cannot break out of its own tag (`escapeClosingTag`).

The caller renders the result in an iframe with `sandbox="allow-scripts"`
(`PREVIEW_IFRAME_SANDBOX`) so preview code never shares the app's origin.
