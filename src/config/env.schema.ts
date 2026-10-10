import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const port = z.coerce.number().int().min(1).max(65_535);
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

/**
 * Every environment variable the application reads. This is the only place that
 * knows about variable names. Keep `.env.example` and
 * `docs/operations/configuration.md` in sync with it.
 */
export const envSchema = z.object({
  // app
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  APP_NAME: z.string().min(1).default('{{PROJECT_NAME}}'),
  APP_VERSION: z.string().min(1).default('0.0.0'),
  APP_COMMIT: z.string().min(1).default('unknown'),
  SHUTDOWN_TIMEOUT_MS: positiveInt.default(15_000),

  // http
  HTTP_HOST: z.string().min(1).default('0.0.0.0'),
  HTTP_PORT: port.default(3000),
  HTTP_CORS_ORIGINS: csv.default([]),
  HTTP_BODY_LIMIT: z
    .string()
    .regex(/^\d+(b|kb|mb)$/i, 'use a size like 100kb or 1mb')
    .default('1mb'),
  HTTP_TRUST_PROXY: bool.default(false),
  DOCS_ENABLED: bool.optional(),

  // database
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DB_POOL_MAX: positiveInt.default(10),
  DB_STATEMENT_TIMEOUT_MS: positiveInt.default(30_000),
  DB_IDLE_TIMEOUT_MS: positiveInt.default(10_000),
  DB_CONNECTION_TIMEOUT_MS: positiveInt.default(5_000),

  // auth
  OIDC_ISSUER_URL: z.url(),
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_JWKS_URL: z.url().optional(),
  OIDC_ROLES_CLAIM_PATH: z.string().min(1).default('realm_access.roles'),
  OIDC_ALGORITHMS: csv.pipe(z.array(z.string().min(1)).min(1)).default(['RS256']),
  OIDC_CLOCK_TOLERANCE_SEC: nonNegativeInt.default(5),

  // jobs
  JOBS_AUTO_MIGRATE: bool.default(true),
  JOBS_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .default('pgboss'),
  JOBS_RETRY_LIMIT: nonNegativeInt.default(3),
  JOBS_RETRY_DELAY_SEC: nonNegativeInt.default(5),
  JOBS_RETRY_BACKOFF: bool.default(true),
  JOBS_EXPIRE_SEC: positiveInt.default(900),
  JOBS_CONCURRENCY: positiveInt.default(5),
  JOBS_QUEUE_DEPTH_INTERVAL_SEC: positiveInt.default(15),
  WORKER_HTTP_PORT: port.default(3001),

  // logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: bool.optional(),

  // telemetry
  METRICS_ENABLED: bool.default(true),
  METRICS_HOST: z.string().min(1).default('0.0.0.0'),
  METRICS_PORT: port.default(9464),
  WORKER_METRICS_PORT: port.default(9465),
  OTEL_SERVICE_NAME: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(1),
  OTEL_METRIC_EXPORT_INTERVAL: positiveInt.default(60_000),
});

export type Env = z.infer<typeof envSchema>;
