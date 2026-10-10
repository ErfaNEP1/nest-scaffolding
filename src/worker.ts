import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, PinoLogger } from 'nestjs-pino';
import { loadConfigOrExit } from './bootstrap';
import { enableGracefulShutdown } from './core/lifecycle';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const config = loadConfigOrExit();
  // An application context: no HTTP routing. Probes run on their own small server.
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const logger = await app.resolve(PinoLogger);
  logger.setContext('Bootstrap');
  enableGracefulShutdown(app, config.app.shutdownTimeoutMs, logger);
  await app.init();
  logger.info({ healthPort: config.jobs.workerHttpPort }, 'worker started');
}

void bootstrap();
