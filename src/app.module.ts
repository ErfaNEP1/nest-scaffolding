import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { type Config, ConfigModule } from './config';
import { AuthModule } from './core/auth';
import { contextModule } from './core/context';
import { DatabaseModule, transactionalPlugin } from './core/database';
import { HealthModule } from './core/health';
import { HttpModule, ProblemDetailsFilter } from './core/http';
import { JobsModule } from './core/jobs';
import { loggerModule } from './core/logging';
import { ObservabilityModule } from './core/observability';
import { featureModules } from './feature-modules';

export interface AppModuleOptions {
  /** `false` builds the app without connecting to PostgreSQL (OpenAPI generation). */
  connectDatabase?: boolean;
}

/** Root module of the API process. */
@Module({})
export class AppModule {
  static forRoot(config: Config, options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        contextModule([transactionalPlugin()]),
        loggerModule(),
        HttpModule,
        DatabaseModule.forRoot({ connect: options.connectDatabase ?? true }),
        ObservabilityModule,
        HealthModule.forApi(),
        AuthModule,
        JobsModule.forRoot({ role: 'api', start: options.connectDatabase ?? true }),
        ...featureModules,
      ],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}
