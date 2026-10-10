import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { ConfigModule } from '../../../src/config';
import { contextModule } from '../../../src/core/context';
import { DatabaseModule, transactionalPlugin } from '../../../src/core/database';
import { loggerModule } from '../../../src/core/logging';
import { SampleEntity } from '../../../src/modules/sample/sample.entity';
import { SampleRepository } from '../../../src/modules/sample/sample.repository';
import { truncateAll } from '../../support/database';
import { createSample } from '../../support/factories';
import { testConfig } from '../../support/test-config';

describe('SampleRepository', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let repository: SampleRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(testConfig({ DATABASE_URL: inject('databaseUrl') })),
        contextModule([transactionalPlugin()]),
        loggerModule(),
        DatabaseModule.forRoot(),
        TypeOrmModule.forFeature([SampleEntity]),
      ],
      providers: [SampleRepository],
    }).compile();
    app = await moduleRef.init();
    dataSource = app.get(DataSource);
    repository = app.get(SampleRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  it('inserts and reads a sample with UTC timestamps', async () => {
    const created = await createSample(dataSource, {
      name: 'one',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
    });
    const found = await repository.findById(created.id);
    expect(found).toMatchObject({ id: created.id, name: 'one', status: 'new', rowVersion: 1 });
    expect(found?.createdAt.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('pages newest first with a keyset cursor, without gaps or duplicates', async () => {
    const base = Date.parse('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < 5; i += 1) {
      await createSample(dataSource, { name: `s${i}`, createdAt: new Date(base + i * 1000) });
    }
    // Two rows with the same timestamp: the id breaks the tie.
    await createSample(dataSource, { name: 's4b', createdAt: new Date(base + 4000) });
    await createSample(dataSource, { name: 'other', ownerId: 'user-2' });

    const seen: string[] = [];
    let after: { sortValue: string; id: string } | undefined;
    for (;;) {
      const rows = await repository.list({ ownerId: 'user-1', limit: 2, after });
      const page = rows.slice(0, 2);
      seen.push(...page.map((row) => row.name));
      const last = page.at(-1);
      if (rows.length <= 2 || !last) break;
      after = { sortValue: last.createdAt.toISOString(), id: last.id };
    }
    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
    expect(seen.slice(2)).toEqual(['s3', 's2', 's1', 's0']);
    expect(seen).not.toContain('other');
  });

  it('updates with the expected row version and rejects a stale one', async () => {
    const sample = await createSample(dataSource);
    const updated = await repository.update(sample.id, 1, { name: 'renamed' });
    expect(updated).toMatchObject({ name: 'renamed', rowVersion: 2 });
    await expect(repository.update(sample.id, 1, { name: 'stale' })).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      status: 409,
    });
  });

  it('marks a sample processed only once (idempotent)', async () => {
    const sample = await createSample(dataSource);
    expect(await repository.markProcessed(sample.id, new Date())).toBe(true);
    expect(await repository.markProcessed(sample.id, new Date())).toBe(false);
    expect(await repository.findById(sample.id)).toMatchObject({
      status: 'processed',
      rowVersion: 2,
    });
  });

  it('enforces the name length constraint in the database', async () => {
    await expect(createSample(dataSource, { name: '' })).rejects.toThrow(/check constraint/);
  });
});
