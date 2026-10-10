import type { DataSource } from 'typeorm';

/**
 * Empties every application table (schema `public`, except `schema_migrations`).
 * Call it in `beforeEach` so tests do not depend on each other.
 */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  const rows: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map((row) => `public."${row.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}
