import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { json } from 'express';
import { ClsMiddleware } from 'nestjs-cls';
import { ZodSerializerInterceptor } from 'nestjs-zod';
import { ConfigService } from '../../config';
import { HttpMetricsMiddleware } from '../observability/http-metrics.middleware';
import { AppValidationPipe } from './zod-validation';

/**
 * HTTP request pipeline for every route (including /health): request context, metrics and
 * JSON body parsing as Nest middleware (so they run
 * after the request context and the access logger: bad or oversized bodies still get a
 * request id and an access log line), Zod validation of inputs and Zod serialization of
 * responses.
 */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class HttpModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        ClsMiddleware,
        HttpMetricsMiddleware,
        json({ limit: this.config.get('http').bodyLimit }),
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
