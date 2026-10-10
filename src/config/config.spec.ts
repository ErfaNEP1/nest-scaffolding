import { describe, expect, it } from 'vitest';
import { ConfigValidationError, loadConfig } from './config';

const minimal = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/app',
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/dev',
  OIDC_AUDIENCE: 'api',
};

describe('loadConfig', () => {
  it('applies defaults for optional variables', () => {
    const config = loadConfig(minimal);
    expect(config.http.port).toBe(3000);
    expect(config.app.env).toBe('production');
    expect(config.http.docsEnabled).toBe(false);
    expect(config.logging.pretty).toBe(false);
    expect(config.auth.algorithms).toEqual(['RS256']);
  });

  it('turns on docs and pretty logs in development', () => {
    const config = loadConfig({ ...minimal, NODE_ENV: 'development' });
    expect(config.http.docsEnabled).toBe(true);
    expect(config.logging.pretty).toBe(true);
  });

  it('parses lists and booleans', () => {
    const config = loadConfig({
      ...minimal,
      HTTP_CORS_ORIGINS: 'https://a.example, https://b.example',
      JOBS_AUTO_MIGRATE: 'false',
    });
    expect(config.http.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.jobs.autoMigrate).toBe(false);
  });

  it('lists every invalid or missing variable', () => {
    try {
      loadConfig({ HTTP_PORT: 'abc' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const problems = (error as ConfigValidationError).problems.join('\n');
      expect(problems).toContain('HTTP_PORT');
      expect(problems).toContain('DATABASE_URL');
      expect(problems).toContain('OIDC_ISSUER_URL');
      expect(problems).toContain('OIDC_AUDIENCE');
    }
  });
});
