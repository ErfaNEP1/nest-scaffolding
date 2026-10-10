import { type DynamicModule, Module } from '@nestjs/common';
import { type Config, ConfigModule } from './config';
import { contextModule } from './core/context';
import { DatabaseModule, transactionalPlugin } from './core/database';
import { HealthModule } from './core/health';
import { JobsModule } from './core/jobs';
import { loggerModule } from './core/logging';
import { ObservabilityModule } from './core/observability';
import { featureModules } from './feature-modules';

/**
 * Root module of the worker process: runs `@JobHandler` methods, serves only health probes
 * (WORKER_HTTP_PORT) and metrics (WORKER_METRICS_PORT). No API routes.
 */
@Module({})
export class WorkerModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        ConfigModule.forRoot(config),
        contextModule([transactionalPlugin()]),
        loggerModule(),
        DatabaseModule.forRoot(),
        ObservabilityModule,
        HealthModule.forWorker(config.jobs.workerHttpPort),
        JobsModule.forRoot({ role: 'worker', start: true }),
        ...featureModules,
      ],
    };
  }
}
