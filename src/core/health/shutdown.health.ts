import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { isShuttingDown } from '../lifecycle/shutdown';

/** Not ready once shutdown started, so load balancers stop sending traffic. */
@Injectable()
export class ShutdownHealthIndicator {
  constructor(private readonly indicator: HealthIndicatorService) {}

  check(): HealthIndicatorResult {
    const check = this.indicator.check('shutdown');
    return isShuttingDown() ? check.down({ reason: 'shutting down' }) : check.up();
  }
}
