import { type Config, loadConfig } from '../../src/config';

/** Environment for tests. Values that need a running container are filled in by the helpers. */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://app:app@localhost:5432/app',
  OIDC_ISSUER_URL: 'https://issuer.test/realms/test',
  OIDC_AUDIENCE: 'api',
  METRICS_ENABLED: 'false',
};

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ ...TEST_ENV, ...overrides });
}
