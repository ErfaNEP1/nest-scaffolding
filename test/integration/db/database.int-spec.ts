import { Injectable, type INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Column, DataSource, type EntityManager, Entity, PrimaryColumn } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { ConfigModule } from '../../../src/config';
import { contextModule } from '../../../src/core/context';
import {
  type DbAdapter,
  DatabaseModule,
  DbSessionContext,
  mapPostgresError,
  Transactional,
  TransactionHost,
  transactionalPlugin,
  updateWithVersion,
} from '../../../src/core/database';
import { ConflictError } from '../../../src/core/errors';
import { loggerModule } from '../../../src/core/logging';
import { newId } from '../../../src/shared/ids';
import { testConfig } from '../../support/test-config';

// Test-only table; real tables are created by db/migrations.
@Entity({ name: 'test_widget' })
class TestWidget {
  @PrimaryColumn('uuid') id!: string;
  @Column('text') displayName!: string;
  @Column('int') rowVersion!: number;
}

@Injectable()
class RecordingSessionContext extends DbSessionContext {
  readonly settings: string[] = [];
  override async apply(manager: EntityManager): Promise<void> {
    await manager.query(`SELECT set_config('app.test_value', 'from-hook', true)`);
    this.settings.push('applied');
  }
}

@Injectable()
class WidgetService {
  constructor(private readonly txHost: TransactionHost<DbAdapter>) {}

  @Transactional()
  async createTwoThenFail(): Promise<void> {
    await this.txHost.tx.insert(TestWidget, { id: newId(), displayName: 'a', rowVersion: 1 });
    await this.txHost.tx.insert(TestWidget, { id: newId(), displayName: 'b', rowVersion: 1 });
    throw new Error('fail after inserts');
  }

  @Transactional()
  async readSessionSetting(): Promise<string> {
    const rows: { value: string }[] = await this.txHost.tx.query(
      `SELECT current_setting('app.test_value', true) AS value`,
    );
    return rows[0]?.value ?? '';
  }
}

describe('database layer', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;

  beforeAll(async () => {
    const config = testConfig({ DATABASE_URL: inject('databaseUrl') });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        contextModule([transactionalPlugin()]),
        loggerModule(),
        DatabaseModule.forRoot({ sessionContext: RecordingSessionContext }),
        TypeOrmModule.forFeature([TestWidget]),
      ],
      providers: [WidgetService],
    }).compile();
    app = await moduleRef.init();
    dataSource = app.get(DataSource);
    await dataSource.query(
      `CREATE TABLE test_widget (id uuid PRIMARY KEY, display_name text UNIQUE NOT NULL, row_version int NOT NULL)`,
    );
  });

  afterAll(async () => {
    await dataSource.query('DROP TABLE IF EXISTS test_widget');
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE test_widget');
  });

  it('maps camelCase properties to snake_case columns', async () => {
    await dataSource.manager.insert(TestWidget, { id: newId(), displayName: 'x', rowVersion: 1 });
    const rows: { display_name: string }[] = await dataSource.query(
      'SELECT display_name FROM test_widget',
    );
    expect(rows[0]?.display_name).toBe('x');
  });

  it('rolls back everything when a @Transactional method throws', async () => {
    await expect(app.get(WidgetService).createTwoThenFail()).rejects.toThrow('fail after inserts');
    expect(await dataSource.manager.count(TestWidget)).toBe(0);
  });

  it('runs the session context hook at the start of each transaction', async () => {
    const hook = app.get<RecordingSessionContext>(DbSessionContext);
    const before = hook.settings.length;
    expect(await app.get(WidgetService).readSessionSetting()).toBe('from-hook');
    expect(hook.settings.length).toBe(before + 1);
  });

  it('updates with optimistic locking and detects stale versions', async () => {
    const id = newId();
    await dataSource.manager.insert(TestWidget, { id, displayName: 'v1', rowVersion: 1 });

    const updated = await updateWithVersion(dataSource.manager, TestWidget, id, 1, {
      displayName: 'v2',
    });
    expect(updated).toMatchObject({ displayName: 'v2', rowVersion: 2 });

    await expect(
      updateWithVersion(dataSource.manager, TestWidget, id, 1, { displayName: 'stale' }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
    await expect(
      updateWithVersion(dataSource.manager, TestWidget, newId(), 1, { displayName: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('maps unique violations to a 409 conflict', async () => {
    await dataSource.manager.insert(TestWidget, {
      id: newId(),
      displayName: 'same',
      rowVersion: 1,
    });
    const error: unknown = await dataSource.manager
      .insert(TestWidget, { id: newId(), displayName: 'same', rowVersion: 1 })
      .catch((caught: unknown) => caught);
    const mapped = mapPostgresError(error);
    expect(mapped).toBeInstanceOf(ConflictError);
    expect(mapped).toMatchObject({ code: 'UNIQUE_VIOLATION', status: 409 });
    expect(mapped?.message).not.toContain('test_widget');
  });

  it('uses UTC and the configured statement timeout', async () => {
    const rows: { tz: string; timeout: string }[] = await dataSource.query(
      `SELECT current_setting('TimeZone') AS tz, current_setting('statement_timeout') AS timeout`,
    );
    expect(rows[0]).toEqual({ tz: 'UTC', timeout: '30s' });
  });
});
