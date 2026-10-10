import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, inject, it } from 'vitest';
import {
  execInPostgres,
  INTERNAL_URL,
  psqlInPostgres,
  writeFilesInPostgres,
} from '../../support/postgres';

/**
 * Tests for db/migrate.sh. Each test gets its own empty database and migrations directory
 * inside the shared PostgreSQL container.
 */
describe('db/migrate.sh', () => {
  const containerId = inject('postgresContainerId');
  let database: string;
  let dir: string;

  const migrate = (...args: string[]) =>
    execInPostgres(containerId, ['bash', '/db/migrate.sh', ...args], {
      MIGRATION_DATABASE_URL: INTERNAL_URL(database),
      MIGRATIONS_DIR: dir,
    });
  const sql = (query: string) => psqlInPostgres(containerId, query, database);
  const write = (files: Record<string, string>) => writeFilesInPostgres(containerId, dir, files);

  beforeEach(async () => {
    const id = randomUUID().replaceAll('-', '').slice(0, 12);
    database = `migrate_${id}`;
    dir = `/tmp/migrations_${id}`;
    await psqlInPostgres(containerId, `CREATE DATABASE ${database}`);
    await write({
      '0001_init.sql': 'CREATE TABLE one (id int);',
      '0002_two.sql': 'CREATE TABLE two (id int);\nINSERT INTO two VALUES (1);',
    });
  });

  it('applies all files in order on a fresh database', async () => {
    const result = await migrate();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('applying 0001_init.sql');
    expect(result.stdout).toContain('2 migration(s) applied');
    expect(
      await sql("SELECT string_agg(version || name, ',' ORDER BY version) FROM schema_migrations"),
    ).toBe('0001init,0002two');
    expect(await sql('SELECT count(*) FROM two')).toBe('1');
  });

  it('does nothing when run again', async () => {
    await migrate();
    const result = await migrate();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('0 migration(s) applied');
    expect(await sql('SELECT count(*) FROM two')).toBe('1');
  });

  it('fails when an applied file was changed, and applies nothing new', async () => {
    await migrate();
    await write({
      '0001_init.sql': 'CREATE TABLE one (id int, name text);',
      '0003_three.sql': 'CREATE TABLE three (id int);',
    });
    const result = await migrate();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('0001_init.sql was changed after it was applied');
    expect(await sql("SELECT to_regclass('three') IS NULL")).toBe('t');
  });

  it('rolls back a failing file and stops', async () => {
    await write({
      '0003_bad.sql': 'CREATE TABLE three (id int);\nSELECT 1 / 0;',
      '0004_after.sql': 'CREATE TABLE four (id int);',
    });
    const result = await migrate();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('division by zero');
    expect(await sql('SELECT count(*) FROM schema_migrations')).toBe('2');
    expect(await sql("SELECT to_regclass('three') IS NULL AND to_regclass('four') IS NULL")).toBe(
      't',
    );
  });

  it('lists pending files with --dry-run and changes nothing', async () => {
    const result = await migrate('--dry-run');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('pending 0001_init.sql');
    expect(result.stdout).toContain('2 pending');
    expect(await sql("SELECT to_regclass('schema_migrations') IS NULL")).toBe('t');
  });

  it('prints applied and pending files with --status', async () => {
    await migrate();
    await write({ '0003_three.sql': 'CREATE TABLE three (id int);' });
    const result = await migrate('--status');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/0001\s+init\s+applied/);
    expect(result.stdout).toMatch(/0003\s+three\s+pending/);
  });

  it('runs files marked no-transaction outside a transaction', async () => {
    await migrate();
    await write({
      '0003_index.sql':
        '-- migrate:no-transaction\nCREATE INDEX CONCURRENTLY two_id_idx ON two (id);',
    });
    const result = await migrate();
    expect(result.exitCode).toBe(0);
    expect(await sql("SELECT to_regclass('two_id_idx') IS NOT NULL")).toBe('t');
  });

  it('rejects badly named files', async () => {
    await write({ '3_bad-name.sql': 'SELECT 1;' });
    const result = await migrate();
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("bad file name '3_bad-name.sql'");
  });

  it('serializes concurrent runs with an advisory lock', async () => {
    const [first, second] = await Promise.all([migrate(), migrate()]);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(await sql('SELECT count(*) FROM schema_migrations')).toBe('2');
    expect(await sql('SELECT count(*) FROM two')).toBe('1');
  });
});
