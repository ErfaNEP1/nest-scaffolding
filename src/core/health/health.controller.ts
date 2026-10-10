import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { HealthService } from './health.service';

/**
 * Probes, outside `/api`, without auth and not access-logged.
 * - `GET /health/live`: the process is up (no dependency checks).
 * - `GET /health/ready`: dependencies are reachable; 503 when not, and during shutdown.
 */
// Public: probes are called by the orchestrator without credentials and expose no data.
@Public()
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live(): unknown {
    return this.health.live().body;
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<unknown> {
    const result = await this.health.ready();
    res.status(result.status);
    return result.body;
  }
}
