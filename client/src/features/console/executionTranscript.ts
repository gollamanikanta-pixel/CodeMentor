/**
 * Reconstructs the visible terminal transcript for non-interactive runners,
 * which receive stdin separately and do not echo typed input into stdout.
 */
export function formatExecutionTranscript(
  stdout: string,
  stdin: string,
  stdinEchoed = false,
): string {
  if (!stdin.trim() || stdinEchoed || !stdout.trim()) return stdout;

  const inputLines = stdin.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const firstLine = inputLines.shift() ?? '';
  const prompt = /(?:enter|input|type|provide)\b[^:\n?]{0,100}[:?][ \t]*/i.exec(stdout);

  if (!prompt) {
    return [firstLine, ...inputLines, stdout].filter(Boolean).join('\n');
  }

  const promptEnd = prompt.index + prompt[0].length;
  const beforePromptEnd = stdout.slice(0, promptEnd);
  const afterPrompt = stdout.slice(promptEnd);
  const echoedInput = [firstLine, ...inputLines].join('\n');
  const echoedFirstLine = afterPrompt.startsWith('\n')
    ? `\n${echoedInput}\n${afterPrompt.slice(1)}`
    : `${echoedInput}\n${afterPrompt}`;

  return beforePromptEnd + echoedFirstLine;
}
