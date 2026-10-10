import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { execInPostgres, POSTGRES_IMAGE } from './postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    postgresContainerId: string;
  }
}

/**
 * Starts one PostgreSQL container for the whole test run, then applies db/migrations by
 * running db/migrate.sh inside the container (the same way Docker Compose does).
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('app')
    .withUsername('app')
    .withPassword('app')
    .withCopyDirectoriesToContainer([{ source: join(__dirname, '..', '..', 'db'), target: '/db' }])
    .start();

  const result = await execInPostgres(container.getId(), ['bash', '/db/migrate.sh']);
  if (result.exitCode !== 0) {
    await container.stop();
    throw new Error(`db/migrate.sh failed:\n${result.output}`);
  }

  project.provide('databaseUrl', container.getConnectionUri());
  project.provide('postgresContainerId', container.getId());
  return async () => {
    await container.stop();
  };
}
