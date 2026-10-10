import { Body, Controller, Get, type INestApplication, Module, Param, Post } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testConfig } from '../../../test/support/test-config';
import { ConfigModule, ConfigService } from '../../config';
import { contextModule } from '../context';
import { NotFoundError, ValidationError } from '../errors';
import { loggerModule } from '../logging';
import { configureHttp } from './configure-http';
import { HttpModule } from './http.module';
import { ProblemDetailsFilter } from './problem-details.filter';

@Controller('things')
class ThingsController {
  @Get(':id')
  get(@Param('id') id: string): { id: string } {
    if (id === 'missing') throw new NotFoundError('THING_NOT_FOUND', 'Thing not found.');
    if (id === 'invalid') {
      throw new ValidationError([{ path: 'id', message: 'Bad id', code: 'invalid_string' }]);
    }
    if (id === 'crash') throw new Error('select * from secrets');
    return { id };
  }

  @Post()
  create(@Body() body: unknown): unknown {
    return body;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot(testConfig({ HTTP_BODY_LIMIT: '1kb' })),
    contextModule(),
    loggerModule(),
    HttpModule,
  ],
  controllers: [ThingsController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
class TestAppModule {}

describe('HTTP pipeline', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureHttp(nest, nest.get(ConfigService));
    app = await nest.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves versioned routes under /api and echoes a valid request id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/things/42')
      .set('x-request-id', 'client-request-0001');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: '42' });
    expect(res.headers['x-request-id']).toBe('client-request-0001');
  });

  it('generates a request id when the client sends an unsafe one', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/things/42')
      .set('x-request-id', 'bad value!');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers domain errors with Problem Details', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/missing');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'urn:problem-type:thing-not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Thing not found.',
      instance: '/api/v1/things/missing',
      code: 'THING_NOT_FOUND',
      requestId: res.headers['x-request-id'],
    });
  });

  it('adds validation issues', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/invalid');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'id', message: 'Bad id', code: 'invalid_string' }],
    });
  });

  it('hides details of unexpected errors', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/crash');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secrets');
  });

  it('maps unknown routes, bad JSON and large bodies', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/api/v1/nope')).body.code).toBe('ROUTE_NOT_FOUND');
    const badJson = await request(server)
      .post('/api/v1/things')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(badJson.status).toBe(400);
    expect(badJson.body.requestId).toBe(badJson.headers['x-request-id']);
    const large = await request(server)
      .post('/api/v1/things')
      .send({ text: 'a'.repeat(2048) });
    expect(large.status).toBe(413);
    expect(large.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/1');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
