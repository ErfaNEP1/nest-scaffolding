import type { INestApplicationContext } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';

const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

let shuttingDown = false;

/** True once a shutdown signal arrived. Readiness checks report "not ready" from then on. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Test helper: resets the shutdown flag. */
export function resetShutdownState(): void {
  shuttingDown = false;
}

/**
 * Graceful shutdown: Nest's shutdown hooks stop the HTTP server (in-flight requests finish),
 * then close pg-boss, the DataSource and telemetry through `onApplicationShutdown` hooks.
 * If that takes longer than `timeoutMs`, the process exits with code 1.
 */
export function enableGracefulShutdown(
  app: INestApplicationContext,
  timeoutMs: number,
  logger: Pick<PinoLogger, 'info' | 'error'>,
): void {
  app.enableShutdownHooks([...SIGNALS]);
  for (const signal of SIGNALS) {
    process.once(signal, () => {
      shuttingDown = true;
      logger.info({ signal, timeoutMs }, 'shutdown started');
      setTimeout(() => {
        logger.error({ signal, timeoutMs }, 'shutdown timed out, forcing exit');
        process.exit(1);
      }, timeoutMs).unref();
    });
  }
}
