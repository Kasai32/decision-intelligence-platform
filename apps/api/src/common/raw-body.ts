import type { IncomingMessage } from 'node:http';

/**
 * Captures the exact raw request bytes on `req.rawBody` (see ADR-0012) —
 * HMAC webhook signatures must be computed over the bytes actually
 * received, not a re-serialized JSON object, which can differ in
 * whitespace/key order and would make a valid signature fail verification.
 * Shared between `main.ts` and `test/utils/bootstrap-app.ts` so e2e tests
 * exercise the exact same body-parsing contract a real client hits.
 */
export function rawBodySaver(
  req: IncomingMessage & { rawBody?: Buffer },
  _res: unknown,
  buffer: Buffer,
): void {
  if (buffer?.length) {
    req.rawBody = buffer;
  }
}
