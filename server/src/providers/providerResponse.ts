export const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('Response byte limit must be a non-negative safe integer.');
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
    try {
      await response.body?.cancel();
    } catch {
      // The size limit remains the relevant error if stream cancellation fails.
    }
    throw new RangeError(`Provider response exceeded the ${maxBytes}-byte limit.`);
  }

  const reader = response.body?.getReader();
  if (!reader) return '';

  const body = Buffer.allocUnsafe(maxBytes);
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the size-limit error when cancelling an untrusted stream.
        }
        throw new RangeError(`Provider response exceeded the ${maxBytes}-byte limit.`);
      }
      Buffer.from(value).copy(body, totalBytes - value.byteLength);
    }
  } finally {
    reader.releaseLock();
  }

  return body.subarray(0, totalBytes).toString('utf8');
}

export async function readBoundedJson<T>(response: Response, maxBytes: number): Promise<T> {
  const text = await readBoundedText(response, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Provider returned invalid JSON.');
  }
}

export function truncateUtf8(value: string, maxBytes: number): string {
  const notice = `\n\n[Output truncated at ${maxBytes} bytes by CodeMentor]`;
  const noticeBytes = Buffer.byteLength(notice, 'utf8');
  const hasRoomForNotice = maxBytes >= noticeBytes;
  const contentLimit = hasRoomForNotice ? maxBytes - noticeBytes : maxBytes;
  const content: string[] = [];
  let usedBytes = 0;

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, 'utf8');
    if (usedBytes + characterBytes > contentLimit) break;
    content.push(character);
    usedBytes += characterBytes;
  }

  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;
  return `${content.join('')}${hasRoomForNotice ? notice : ''}`;
}
