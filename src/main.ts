import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadConfigOrExit } from './bootstrap';
import { ConfigService } from './config';
import { apiInfo } from './api-info';
import { buildOpenApiDocument, configureHttp, serveApiDocs } from './core/http';
import { enableGracefulShutdown } from './core/lifecycle';

async function bootstrap(): Promise<void> {
  const config = loadConfigOrExit();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  const logger = await app.resolve(PinoLogger);
  logger.setContext('Bootstrap');

  configureHttp(app, app.get(ConfigService));
  if (config.http.docsEnabled) serveApiDocs(app, buildOpenApiDocument(app, apiInfo()));
  enableGracefulShutdown(app, config.app.shutdownTimeoutMs, logger);

  await app.listen(config.http.port, config.http.host);
  logger.info({ port: config.http.port }, 'api started');
}

void bootstrap();
