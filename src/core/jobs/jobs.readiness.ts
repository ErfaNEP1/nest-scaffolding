import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { ReadinessCheck } from '../health/readiness-check';
import { JobsService } from './jobs.service';

/** Readiness: pg-boss is started. */
@Injectable()
export class JobsReadinessCheck extends ReadinessCheck {
  constructor(
    private readonly jobs: JobsService,
    private readonly indicator: HealthIndicatorService,
  ) {
    super();
  }

  override check(): HealthIndicatorResult {
    const check = this.indicator.check('jobs');
    return this.jobs.isStarted() ? check.up() : check.down({ reason: 'pg-boss not started' });
  }
}
