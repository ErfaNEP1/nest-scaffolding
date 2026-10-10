import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { inject } from 'vitest';
import { WorkerModule } from '../../src/worker.module';
import { testConfig } from './test-config';

/** Starts the real worker (job handlers) in-process against the test database. */
export async function createTestWorker(
  env: Record<string, string> = {},
): Promise<INestApplicationContext> {
  const config = testConfig({ DATABASE_URL: inject('databaseUrl'), WORKER_HTTP_PORT: '0', ...env });
  const worker = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), {
    logger: false,
  });
  return worker.init();
}
