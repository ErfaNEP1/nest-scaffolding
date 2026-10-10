import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { type Config, ConfigModule } from './config';
import { contextModule } from './core/context';
import { HttpModule, ProblemDetailsFilter } from './core/http';
import { loggerModule } from './core/logging';

/** Root module of the API process. */
@Module({})
export class AppModule {
  static forRoot(config: Config): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), contextModule(), loggerModule(), HttpModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}
