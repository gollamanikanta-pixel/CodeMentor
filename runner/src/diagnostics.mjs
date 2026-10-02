const linePatterns = {
  python: [/File ".*\/main\.py", line (\d+)/],
  javascript: [/\bmain\.js:(\d+)(?::\d+)?/],
  c: [/\bmain\.c:(\d+):\d+(?::|: error:)/],
  cpp: [/\bmain\.cpp:(\d+):\d+(?::|: error:)/, /\bmain\.(?:cc|cxx):(\d+):\d+(?::|: error:)/],
  java: [/\bMain\.java:(\d+)(?:\)|:)/],
  csharp: [/\bmain\.cs\((\d+),\d+\)/, /\bmain\.cs:line (\d+)/],
  go: [/\bmain\.go:(\d+)(?::\d+)?/],
  php: [/\bmain\.php on line (\d+)/, /\bmain\.php:(\d+)/],
  ruby: [/\bmain\.rb:(\d+):in\b/],
  rust: [/--> main\.rs:(\d+):\d+/],
  kotlin: [/\bMain\.kt:(\d+)(?::\d+)?/],
};

export function errorLineFromOutput(language, output, sourceLineCount) {
  const patterns = linePatterns[language];
  if (!patterns || !output || sourceLineCount < 1) return null;
  const plainOutput = output
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

  for (const pattern of patterns) {
    const match = pattern.exec(plainOutput);
    if (!match) continue;
    const line = Number(match[1]);
    if (Number.isInteger(line) && line >= 1 && line <= sourceLineCount) return line;
  }
  return null;
}
