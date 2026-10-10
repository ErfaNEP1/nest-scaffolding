import { Injectable } from '@nestjs/common';
import type { Config } from './config';

/** Typed access to configuration. The only way application code reads settings. */
@Injectable()
export class ConfigService {
  constructor(private readonly config: Config) {}

  get<K extends keyof Config>(section: K): Config[K] {
    return this.config[section];
  }

  get isDevelopment(): boolean {
    return this.config.app.env === 'development';
  }
}
