import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { type Config, ConfigModule } from './config';
import { contextModule } from './core/context';
import { DatabaseModule, transactionalPlugin } from './core/database';
import { HttpModule, ProblemDetailsFilter } from './core/http';
import { loggerModule } from './core/logging';

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
      ],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}
