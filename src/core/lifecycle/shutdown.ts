import type { INestApplicationContext } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

let shuttingDown = false;

/** True once a shutdown signal arrived. Readiness checks report "not ready" from then on. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Marks the process as shutting down (also used by tests). */
export function markShuttingDown(): void {
  shuttingDown = true;
}

/** Test helper: resets the shutdown flag. */
export function resetShutdownState(): void {
  shuttingDown = false;
}

function flush(logger: PinoLogger<string>): Promise<void> {
  return new Promise((resolve) => {
    logger.logger.flush(() => {
      resolve();
    });
  });
}

/**
 * Graceful shutdown on SIGTERM / SIGINT:
 * 1. readiness turns 503 (`isShuttingDown()`),
 * 2. `app.close()` runs Nest's shutdown hooks: the HTTP server stops accepting connections
 *    and waits for in-flight requests, then pg-boss, the DataSource and telemetry close
 *    in their `onApplicationShutdown` hooks,
 * 3. logs are flushed and the process exits with code 0.
 * If this takes longer than `timeoutMs`, the process exits with code 1.
 *
 * Nest's `enableShutdownHooks()` is not used: it re-raises the signal right after the
 * hooks, which kills the process before buffered log lines are written.
 */
export function enableGracefulShutdown(
  app: INestApplicationContext,
  timeoutMs: number,
  logger: PinoLogger<string>,
): void {
  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    markShuttingDown();
    logger.info({ signal, timeoutMs }, 'shutdown started');
    setTimeout(() => {
      logger.error({ signal, timeoutMs }, 'shutdown timed out, forcing exit');
      void flush(logger).finally(() => process.exit(1));
    }, timeoutMs).unref();

    app
      .close()
      .then(async () => {
        logger.info({ signal }, 'shutdown complete');
        await flush(logger);
        process.exit(0);
      })
      .catch(async (error: unknown) => {
        logger.error({ err: error }, 'shutdown failed');
        await flush(logger);
        process.exit(1);
      });
  };
  for (const signal of SIGNALS) process.on(signal, onSignal);
}
