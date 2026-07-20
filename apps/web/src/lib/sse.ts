import { getAccessToken } from './auth-storage';
import { ApiError } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface SseEvent {
  /** Undefined for a plain streamed chunk; a name (e.g. "result", "error") for a typed event. */
  event?: string;
  data: string;
}

function parseSseBlock(raw: string): SseEvent | null {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
    }
    // id:/retry:/comment lines are intentionally ignored — nothing here needs them.
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/**
 * Consumes a POST-based Server-Sent-Events endpoint (see ADR-0020) — plain
 * `fetch` + a manual reader, not the browser `EventSource` API, since
 * `EventSource` can only do GET requests with no custom headers and this
 * platform's auth is a bearer token, not a cookie.
 */
export async function* streamSse(path: string): AsyncGenerator<SseEvent, void, void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(response.status, message ?? 'Request failed');
  }
  if (!response.body) {
    throw new ApiError(response.status, 'The server did not return a streamable response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const parsed = parseSseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (parsed) yield parsed;
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
