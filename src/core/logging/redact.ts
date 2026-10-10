export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /^(authorization|proxy-authorization|cookie|set-cookie)$|pass(word|wd)?$|secret|token|api[-_]?key|private[-_]?key|credential/i;

const MAX_DEPTH = 10;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/**
 * Returns a copy of `value` with sensitive fields replaced at any depth.
 * Errors are kept as they are so the error serializer can still read the stack.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || value instanceof Error) return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (depth >= MAX_DEPTH) return '[Truncated]';
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactDeep(item, depth + 1);
  }
  return result;
}

/** {@link redactDeep} for a plain object, as used by the pino `formatters.log` hook. */
export function redactObject(object: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(object)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactDeep(item, 1);
  }
  return result;
}
