/**
 * Extracts the most likely source line from a compiler or runtime diagnostic.
 *
 * Shared by every secure-runner normalizer so the "estimated line" rule is
 * defined exactly once. Pure: no fetch, no clock, no environment access — so it
 * can be unit-tested in isolation.
 *
 * Matches the first `file.ext:LINE(:COL): error:` style location for any
 * extension CodeMentor runs, e.g. `main.c:5:3: error:` or `Main.java:12: error:`.
 */
export function errorLineFromOutput(text: string): number | null {
  const match = text.match(/^[^\s:]+\.(?:c|h|cpp|cc|cxx|hpp|java|cs|go|php|rb|rs|kt):(\d+)(?::\d+)?:/m);
  if (!match) return null;
  const line = Number.parseInt(match[1], 10);
  return Number.isFinite(line) && line > 0 ? line : null;
}
