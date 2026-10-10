import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import {
  HealthCheckService,
  type HealthIndicatorFunction,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ReadinessCheck } from './readiness-check';
import { ShutdownHealthIndicator } from './shutdown.health';

const DB_PING_TIMEOUT_MS = 2_000;

export interface ProbeResult {
  status: 200 | 503;
  body: unknown;
}

/** Liveness and readiness logic, shared by the API controller and the worker probe server. */
@Injectable()
export class HealthService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly shutdown: ShutdownHealthIndicator,
    @Optional() private readonly extra?: ReadinessCheck,
  ) {}

  live(): ProbeResult {
    return { status: 200, body: { status: 'ok' } };
  }

  /** Ready when not shutting down, the database answers and extra checks (jobs) pass. */
  async ready(): Promise<ProbeResult> {
    const checks: HealthIndicatorFunction[] = [
      () => this.shutdown.check(),
      () => this.db.pingCheck('database', { timeout: DB_PING_TIMEOUT_MS }),
    ];
    const extra = this.extra;
    if (extra) checks.push(() => extra.check());
    try {
      return { status: 200, body: await this.health.check(checks) };
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      return { status: 503, body: error.getResponse() };
    }
  }
}
