import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { markShuttingDown, resetShutdownState } from '../../src/core/lifecycle';
import { createTestApp, type TestApp } from '../support/app-factory';

describe('health endpoints', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('GET /health/live answers without checking dependencies', async () => {
    const res = await request(testApp.server).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns x-request-id on probes too', async () => {
    const res = await request(testApp.server)
      .get('/health/live')
      .set('x-request-id', 'probe-request-0001');
    expect(res.headers['x-request-id']).toBe('probe-request-0001');
  });

  it('GET /health/ready checks the database', async () => {
    const res = await request(testApp.server).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.details.database.status).toBe('up');
  });

  it('is not served under /api', async () => {
    expect((await request(testApp.server).get('/api/v1/health/live')).status).toBe(404);
  });

  it('GET /health/ready answers 503 once shutdown started', async () => {
    markShuttingDown();
    try {
      expect((await request(testApp.server).get('/health/ready')).status).toBe(503);
    } finally {
      resetShutdownState();
    }
  });
});
