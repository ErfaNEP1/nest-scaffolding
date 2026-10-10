import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/config';
import { configureHttp } from '../../src/core/http';
import { testConfig } from './test-config';

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  /** The HTTP server, for supertest: `request(testApp.server)`. */
  server: ReturnType<INestApplication['getHttpServer']>;
}

/**
 * Builds the real API (same modules and HTTP settings as src/main.ts) against the test
 * database. Pass env overrides, for example `{ OIDC_JWKS_URL: ... }`.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const config = testConfig({ DATABASE_URL: inject('databaseUrl'), ...env });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureHttp(app, app.get(ConfigService));
  await app.init();
  return { app, dataSource: app.get(DataSource), server: app.getHttpServer() };
}
