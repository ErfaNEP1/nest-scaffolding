import { getContainerRuntimeClient } from 'testcontainers';

/** Image for Testcontainers; set POSTGRES_IMAGE to test against another version. */
export const POSTGRES_IMAGE = process.env.POSTGRES_IMAGE ?? 'postgres:18-alpine';

/** URL for connections made from inside the container (db/migrate.sh). */
export const INTERNAL_URL = (database = 'app') => `postgres://app:app@localhost:5432/${database}`;

export interface ExecResult {
  exitCode: number;
  output: string;
  stdout: string;
  stderr: string;
}

/** Runs a command inside the test PostgreSQL container. */
export async function execInPostgres(
  containerId: string,
  command: string[],
  env: Record<string, string> = {},
): Promise<ExecResult> {
  const client = await getContainerRuntimeClient();
  const container = client.container.getById(containerId);
  return client.container.exec(container, command, {
    env: { MIGRATION_DATABASE_URL: INTERNAL_URL(), ...env },
  });
}

/** Writes files into the container (content is passed base64-encoded, so any text is safe). */
export async function writeFilesInPostgres(
  containerId: string,
  dir: string,
  files: Record<string, string>,
): Promise<void> {
  const script = [`mkdir -p '${dir}'`];
  for (const [name, content] of Object.entries(files)) {
    const encoded = Buffer.from(content, 'utf8').toString('base64');
    script.push(`echo '${encoded}' | base64 -d > '${dir}/${name}'`);
  }
  const result = await execInPostgres(containerId, ['sh', '-c', script.join(' && ')]);
  if (result.exitCode !== 0) throw new Error(result.output);
}

/** Runs a SQL statement with psql inside the container and returns trimmed output. */
export async function psqlInPostgres(
  containerId: string,
  sql: string,
  database = 'app',
): Promise<string> {
  const result = await execInPostgres(containerId, [
    'psql',
    INTERNAL_URL(database),
    '-v',
    'ON_ERROR_STOP=1',
    '-Atc',
    sql,
  ]);
  if (result.exitCode !== 0) throw new Error(result.output);
  return result.stdout.trim();
}
