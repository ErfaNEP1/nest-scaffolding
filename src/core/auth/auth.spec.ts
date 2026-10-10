import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestIssuer } from '../../../test/support/auth';
import { testConfig } from '../../../test/support/test-config';
import { ConfigModule, ConfigService } from '../../config';
import { contextModule, currentContext } from '../context';
import { configureHttp, HttpModule, ProblemDetailsFilter } from '../http';
import { loggerModule } from '../logging';
import { AuthModule } from './auth.module';
import { CurrentUser, Public, Roles } from './decorators';
import type { Principal } from './principal';

@Controller('things')
class ThingsController {
  // Public: test route.
  @Public()
  @Get('public')
  open(): string {
    return 'open';
  }

  @Get('me')
  me(@CurrentUser() user: Principal): { subject: string; roles: string[]; userId?: string } {
    const { userId } = currentContext();
    return { subject: user.subject, roles: user.roles, ...(userId ? { userId } : {}) };
  }

  @Roles('admin')
  @Get('admin')
  admin(): string {
    return 'admin';
  }
}

async function buildApp(env: Record<string, string>): Promise<INestApplication> {
  @Module({
    imports: [
      ConfigModule.forRoot(testConfig(env)),
      contextModule(),
      loggerModule(),
      HttpModule,
      AuthModule,
    ],
    controllers: [ThingsController],
    providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
  })
  class TestModule {}
  const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureHttp(app, app.get(ConfigService));
  return app.init();
}

describe('OIDC authentication', () => {
  let issuer: TestIssuer;
  let app: INestApplication;

  beforeAll(async () => {
    issuer = await TestIssuer.start();
    app = await buildApp(issuer.env());
  });

  afterAll(async () => {
    await app.close();
    await issuer.close();
  });

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/api/v1/things/${path}`);
    return token ? req.set('authorization', `Bearer ${token}`) : req;
  };

  it('lets public routes through without a token', async () => {
    expect((await get('public')).status).toBe(200);
  });

  it('answers 401 Problem Details without a token', async () => {
    const res = await get('me');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('accepts a valid token and exposes the principal and userId context', async () => {
    const token = await issuer.token({ subject: 'abc', roles: ['user'] });
    const res = await get('me', token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subject: 'abc', roles: ['user'], userId: 'abc' });
  });

  it.each([
    ['wrong audience', { audience: 'other-api' }],
    ['wrong issuer', { issuer: 'https://evil.test' }],
  ])('rejects a token with %s', async (_name, options) => {
    const res = await get('me', await issuer.token(options));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token', async () => {
    const res = await get(
      'me',
      await issuer.token({ expiresIn: Math.floor(Date.now() / 1000) - 60 }),
    );
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token signed by another key', async () => {
    const other = await TestIssuer.start();
    try {
      expect((await get('me', await other.token())).status).toBe(401);
    } finally {
      await other.close();
    }
  });

  it('checks roles: 403 without the role, 200 with it', async () => {
    expect((await get('admin', await issuer.token({ roles: ['user'] }))).status).toBe(403);
    expect((await get('admin', await issuer.token({ roles: ['admin'] }))).status).toBe(200);
  });

  it('answers 503 when the JWKS cannot be fetched', async () => {
    const offline = await buildApp({ OIDC_JWKS_URL: 'http://127.0.0.1:1/certs' });
    try {
      const res = await request(offline.getHttpServer())
        .get('/api/v1/things/me')
        .set('authorization', `Bearer ${await issuer.token()}`);
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'AUTH_UNAVAILABLE', retryable: true });
    } finally {
      await offline.close();
    }
  });
});
