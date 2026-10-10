import type { INestApplicationContext } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestIssuer } from '../support/auth';
import { createTestApp, type TestApp } from '../support/app-factory';
import { truncateAll } from '../support/database';
import { waitFor } from '../support/wait-for';
import { createTestWorker } from '../support/worker-factory';

describe('samples API (/api/v1/samples)', () => {
  let issuer: TestIssuer;
  let testApp: TestApp;
  let worker: INestApplicationContext;
  let alice: string;
  let bob: string;
  let admin: string;
  let noRole: string;

  beforeAll(async () => {
    issuer = await TestIssuer.start();
    testApp = await createTestApp(issuer.env());
    worker = await createTestWorker(issuer.env());
    alice = await issuer.token({ subject: 'alice', roles: ['user'] });
    bob = await issuer.token({ subject: 'bob', roles: ['user'] });
    admin = await issuer.token({ subject: 'root', roles: ['admin'] });
    noRole = await issuer.token({ subject: 'guest', roles: [] });
  });

  afterAll(async () => {
    await worker.close();
    await testApp.app.close();
    await issuer.close();
  });

  beforeEach(async () => {
    await truncateAll(testApp.dataSource);
  });

  const api = () => request(testApp.server);
  const create = (token: string, body: object) =>
    api().post('/api/v1/samples').set('authorization', `Bearer ${token}`).send(body);
  const get = (token: string, id: string) =>
    api().get(`/api/v1/samples/${id}`).set('authorization', `Bearer ${token}`);

  it('creates a sample, and the worker processes it', async () => {
    const res = await create(alice, { name: '  First  ', description: 'hello' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'First',
      description: 'hello',
      status: 'new',
      rowVersion: 1,
      processedAt: null,
    });
    expect(Object.keys(res.body)).not.toContain('ownerId');

    const processed = await waitFor(async () => {
      const current = await get(alice, res.body.id);
      return current.body.status === 'processed' && current.body;
    });
    expect(processed.rowVersion).toBe(2);
    expect(processed.processedAt).toMatch(/Z$/);
  });

  it('validates the request body', async () => {
    const res = await create(alice, { name: '', extra: 1 });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'name' })]),
    );
  });

  it('answers 404 for unknown ids and for samples of other users', async () => {
    const own = await create(alice, { name: 'mine' });
    expect((await get(bob, own.body.id)).body.code).toBe('SAMPLE_NOT_FOUND');
    expect((await get(alice, '01970000-0000-7000-8000-000000000000')).status).toBe(404);
    expect((await get(admin, own.body.id)).status).toBe(200);
    expect((await get(alice, 'not-a-uuid')).status).toBe(400);
  });

  it('requires a token (401) and the user role (403)', async () => {
    const anonymous = await api().get('/api/v1/samples');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe('UNAUTHORIZED');
    const forbidden = await api().get('/api/v1/samples').set('authorization', `Bearer ${noRole}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });

  it('lists with cursor pagination', async () => {
    for (const name of ['a', 'b', 'c']) await create(alice, { name });
    await create(bob, { name: 'not alice' });

    const first = await api()
      .get('/api/v1/samples?limit=2')
      .set('authorization', `Bearer ${alice}`);
    expect(first.status).toBe(200);
    expect(first.body.items.map((s: { name: string }) => s.name)).toEqual(['c', 'b']);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await api()
      .get(`/api/v1/samples?limit=2&cursor=${first.body.nextCursor}`)
      .set('authorization', `Bearer ${alice}`);
    expect(second.body.items.map((s: { name: string }) => s.name)).toEqual(['a']);
    expect(second.body.nextCursor).toBeNull();

    const bad = await api()
      .get('/api/v1/samples?cursor=garbage')
      .set('authorization', `Bearer ${alice}`);
    expect(bad.status).toBe(400);
  });

  it('updates with optimistic locking', async () => {
    const created = await create(alice, { name: 'v1' });
    const patch = (body: object) =>
      api()
        .patch(`/api/v1/samples/${created.body.id}`)
        .set('authorization', `Bearer ${alice}`)
        .send(body);

    // Wait for the worker so it cannot change the row version during the test.
    const current = await waitFor(async () => {
      const res = await get(alice, created.body.id);
      return res.body.status === 'processed' && res;
    });
    const updated = await patch({ name: 'v2', rowVersion: current.body.rowVersion });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'v2', rowVersion: current.body.rowVersion + 1 });

    const stale = await patch({ name: 'v3', rowVersion: current.body.rowVersion });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');

    expect((await patch({ rowVersion: 1 })).status).toBe(400);
  });
});
