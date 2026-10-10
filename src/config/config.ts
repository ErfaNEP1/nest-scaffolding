import { type Env, envSchema } from './env.schema';

export type NodeEnv = Env['NODE_ENV'];
export type LogLevel = Env['LOG_LEVEL'];

/** Typed, sectioned configuration built from the environment. */
export interface Config {
  app: {
    env: NodeEnv;
    name: string;
    version: string;
    commit: string;
    shutdownTimeoutMs: number;
  };
  http: {
    host: string;
    port: number;
    corsOrigins: string[];
    bodyLimit: string;
    trustProxy: boolean;
    docsEnabled: boolean;
  };
  database: {
    url: string;
    poolMax: number;
    statementTimeoutMs: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
  auth: {
    issuerUrl: string;
    audience: string;
    jwksUrl: string | undefined;
    rolesClaimPath: string;
    algorithms: string[];
    clockToleranceSec: number;
  };
  jobs: {
    autoMigrate: boolean;
    schema: string;
    retryLimit: number;
    retryDelaySec: number;
    retryBackoff: boolean;
    expireSec: number;
    concurrency: number;
    queueDepthIntervalSec: number;
    workerHttpPort: number;
  };
  logging: {
    level: LogLevel;
    pretty: boolean;
  };
  telemetry: {
    metricsEnabled: boolean;
    metricsHost: string;
    metricsPort: number;
    workerMetricsPort: number;
    serviceName: string;
    otlpEndpoint: string | undefined;
    traceSampleRatio: number;
    metricExportIntervalMs: number;
  };
}

export class ConfigValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validates the environment and builds the typed configuration.
 * Throws {@link ConfigValidationError} listing every invalid or missing variable.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return toConfig(parsed.data);
}

function toConfig(env: Env): Config {
  const isDev = env.NODE_ENV === 'development';
  return {
    app: {
      env: env.NODE_ENV,
      name: env.APP_NAME,
      version: env.APP_VERSION,
      commit: env.APP_COMMIT,
      shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    },
    http: {
      host: env.HTTP_HOST,
      port: env.HTTP_PORT,
      corsOrigins: env.HTTP_CORS_ORIGINS,
      bodyLimit: env.HTTP_BODY_LIMIT,
      trustProxy: env.HTTP_TRUST_PROXY,
      docsEnabled: env.DOCS_ENABLED ?? isDev,
    },
    database: {
      url: env.DATABASE_URL,
      poolMax: env.DB_POOL_MAX,
      statementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
      idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMs: env.DB_CONNECTION_TIMEOUT_MS,
    },
    auth: {
      issuerUrl: env.OIDC_ISSUER_URL,
      audience: env.OIDC_AUDIENCE,
      jwksUrl: env.OIDC_JWKS_URL,
      rolesClaimPath: env.OIDC_ROLES_CLAIM_PATH,
      algorithms: env.OIDC_ALGORITHMS,
      clockToleranceSec: env.OIDC_CLOCK_TOLERANCE_SEC,
    },
    jobs: {
      autoMigrate: env.JOBS_AUTO_MIGRATE,
      schema: env.JOBS_SCHEMA,
      retryLimit: env.JOBS_RETRY_LIMIT,
      retryDelaySec: env.JOBS_RETRY_DELAY_SEC,
      retryBackoff: env.JOBS_RETRY_BACKOFF,
      expireSec: env.JOBS_EXPIRE_SEC,
      concurrency: env.JOBS_CONCURRENCY,
      queueDepthIntervalSec: env.JOBS_QUEUE_DEPTH_INTERVAL_SEC,
      workerHttpPort: env.WORKER_HTTP_PORT,
    },
    logging: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY ?? isDev,
    },
    telemetry: {
      metricsEnabled: env.METRICS_ENABLED,
      metricsHost: env.METRICS_HOST,
      metricsPort: env.METRICS_PORT,
      workerMetricsPort: env.WORKER_METRICS_PORT,
      serviceName: env.OTEL_SERVICE_NAME ?? env.APP_NAME,
      otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      traceSampleRatio: env.OTEL_TRACES_SAMPLER_ARG,
      metricExportIntervalMs: env.OTEL_METRIC_EXPORT_INTERVAL,
    },
  };
}

/** Names of all variables in the schema. Used by tests that check the docs stay in sync. */
export const envVariableNames: readonly string[] = Object.keys(envSchema.shape);
