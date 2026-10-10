import { newId } from '../../shared/ids';

export const REQUEST_ID_HEADER = 'x-request-id';

const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Uses the client's `x-request-id` when it is a safe value, otherwise generates a UUIDv7.
 * Unsafe values are dropped so they cannot inject content into logs or headers.
 */
export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate !== undefined && VALID_REQUEST_ID.test(candidate) ? candidate : newId();
}

/**
 * Request id for an incoming request. The first middleware that asks (context or access
 * logger) resolves it and stores it on `req.id`, so both always agree.
 */
export function requestIdFor(req: {
  id?: unknown;
  headers: Record<string, string | string[] | undefined>;
}): string {
  if (typeof req.id === 'string') return req.id;
  const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  req.id = id;
  return id;
}
