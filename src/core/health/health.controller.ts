import {
  Controller,
  Get,
  Optional,
  Res,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  type HealthCheckResult,
  HealthCheckService,
  type HealthIndicatorFunction,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type { Response } from 'express';
import { ReadinessCheck } from './readiness-check';
import { ShutdownHealthIndicator } from './shutdown.health';

const DB_PING_TIMEOUT_MS = 2_000;

/**
 * Probes, outside `/api`, without auth and not access-logged.
 * - `GET /health/live`: the process is up (no dependency checks).
 * - `GET /health/ready`: dependencies are reachable; 503 when not, and during shutdown.
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly shutdown: ShutdownHealthIndicator,
    @Optional() private readonly extra?: ReadinessCheck,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthCheckResult | object | string> {
    const checks: HealthIndicatorFunction[] = [
      () => this.shutdown.check(),
      () => this.db.pingCheck('database', { timeout: DB_PING_TIMEOUT_MS }),
    ];
    const extra = this.extra;
    if (extra) checks.push(() => extra.check());
    try {
      return await this.health.check(checks);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      res.status(503);
      return error.getResponse();
    }
  }
}
