import { type DynamicModule, Global, Module } from '@nestjs/common';
import { type Config, loadConfig } from './config';
import { ConfigService } from './config.service';

@Global()
@Module({})
export class ConfigModule {
  /** Registers {@link ConfigService} globally. Pass a config to override the environment (tests). */
  static forRoot(config?: Config): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: ConfigService, useValue: new ConfigService(config ?? loadConfig()) }],
      exports: [ConfigService],
    };
  }
}
