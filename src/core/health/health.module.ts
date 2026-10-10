import { type DynamicModule, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PROBE_PORT, ProbeServer } from './probe-server';
import { ShutdownHealthIndicator } from './shutdown.health';

const base = {
  imports: [TerminusModule.forRoot({ errorLogStyle: 'json' })],
  providers: [ShutdownHealthIndicator, HealthService],
};

@Module({})
export class HealthModule {
  /** API: health routes served by the Nest HTTP server. */
  static forApi(): DynamicModule {
    return { module: HealthModule, ...base, controllers: [HealthController] };
  }

  /** Worker: a separate probe server on `port`. */
  static forWorker(port: number): DynamicModule {
    return {
      module: HealthModule,
      ...base,
      providers: [...base.providers, { provide: PROBE_PORT, useValue: port }, ProbeServer],
    };
  }
}
