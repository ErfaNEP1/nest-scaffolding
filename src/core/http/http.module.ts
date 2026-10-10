import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { json } from 'express';
import { ConfigService } from '../../config';

/**
 * Parses JSON bodies as Nest middleware, so it runs after the request context and the
 * access logger: bad or oversized bodies still get a request id and an access log line.
 */
@Module({})
export class HttpModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(json({ limit: this.config.get('http').bodyLimit }))
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
