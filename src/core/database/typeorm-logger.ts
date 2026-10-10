import type { PinoLogger } from 'nestjs-pino';
import type { Logger as TypeOrmLogger } from 'typeorm';

/** Slow queries are logged at `warn` above this duration. */
export const SLOW_QUERY_MS = 1_000;

/**
 * Sends TypeORM messages to pino. Query text is logged, parameters are not (they can
 * hold personal data). Every query is logged only at `trace`.
 */
export class PinoTypeOrmLogger implements TypeOrmLogger {
  constructor(private readonly logger: PinoLogger) {}

  logQuery(query: string): void {
    this.logger.trace({ query }, 'db query');
  }

  logQueryError(error: string | Error, query: string): void {
    this.logger.debug({ err: error, query }, 'db query failed');
  }

  logQuerySlow(durationMs: number, query: string): void {
    this.logger.warn({ durationMs, query }, 'slow db query');
  }

  logSchemaBuild(): void {
    // Schema changes only happen through db/migrations.
  }

  logMigration(): void {
    // TypeORM migrations are not used.
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') this.logger.warn({ detail: message }, 'typeorm');
    else this.logger.debug({ detail: message }, 'typeorm');
  }
}
