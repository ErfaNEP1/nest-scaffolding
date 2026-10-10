/** Current time. Use this (not `new Date()`) so tests can stub one function. */
export function now(): Date {
  return new Date();
}

/** ISO-8601 string in UTC, for example `2026-01-31T12:00:00.000Z`. */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}
