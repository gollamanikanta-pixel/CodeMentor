export const MAX_RUN_OUTPUT_CHARS = 20_000;

const TRUNCATION_NOTICE = '\n... output stopped here to keep the lesson readable.';

export class BoundedOutputBuffer {
  private readonly chunks: string[] = [];
  private length = 0;
  private truncated = false;

  constructor(private readonly limit = MAX_RUN_OUTPUT_CHARS) {}

  write(value: string): void {
    if (this.truncated) return;

    const separator = this.chunks.length > 0 ? '\n' : '';
    const remaining = this.limit - this.length;
    if (separator.length + value.length <= remaining) {
      this.chunks.push(value);
      this.length += separator.length + value.length;
      return;
    }

    if (remaining < separator.length) {
      this.truncated = true;
      return;
    }
    const contentLength = Math.max(0, remaining - separator.length);
    if (separator.length > 0 || contentLength > 0 || this.chunks.length === 0) {
      this.chunks.push(value.slice(0, contentLength));
      this.length += separator.length + contentLength;
    }
    this.truncated = true;
  }

  toString(): string {
    return this.chunks.join('\n') + (this.truncated ? TRUNCATION_NOTICE : '');
  }
}

export function boundOutputText(value: string): string {
  const output = new BoundedOutputBuffer();
  output.write(value);
  return output.toString();
}
