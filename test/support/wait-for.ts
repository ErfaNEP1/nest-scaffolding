/**
 * Polls `check` until it returns a value that is not undefined/false, or fails after
 * `timeoutMs`. Use it for asynchronous outcomes (jobs) instead of fixed sleeps.
 */
export async function waitFor<T>(
  check: () => Promise<T | undefined | false> | T | undefined | false,
  { timeoutMs = 15_000, intervalMs = 50 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined && value !== false) return value;
    if (Date.now() > deadline) throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
