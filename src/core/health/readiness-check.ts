import type { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * Optional extra readiness check (for example "pg-boss is started"). Provide an
 * implementation under this class token and `/health/ready` includes it.
 */
export abstract class ReadinessCheck {
  abstract check(): Promise<HealthIndicatorResult> | HealthIndicatorResult;
}
