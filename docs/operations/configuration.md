# Configuration

All settings come from environment variables. They are validated at startup by the Zod
schema in `src/config/env.schema.ts`; the process exits with a list of every invalid or
missing variable. Application code reads them only through `ConfigService`.

Local defaults live in `.env.example`. A test (`src/config/env-docs.spec.ts`) fails if a
variable in the schema is missing from `.env.example` or from this page.

Required variables have no default and must be set in every environment.

## app

| Variable              | Default            | Description                                                                                        |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `production`       | `development`, `test` or `production`. `development` turns on pretty logs and API docs by default. |
| `APP_NAME`            | `{{PROJECT_NAME}}` | Service name in logs (`service`) and metrics.                                                      |
| `APP_VERSION`         | `0.0.0`            | Release version, shown in logs and `build_info`. Set by the image build.                           |
| `APP_COMMIT`          | `unknown`          | Git commit of the build, shown in `build_info`.                                                    |
| `SHUTDOWN_TIMEOUT_MS` | `15000`            | Maximum time for graceful shutdown before the process exits with code 1.                           |

## http

| Variable            | Default                             | Description                                                                        |
| ------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `HTTP_HOST`         | `0.0.0.0`                           | Interface the API listens on.                                                      |
| `HTTP_PORT`         | `3000`                              | API port.                                                                          |
| `HTTP_CORS_ORIGINS` | empty                               | Comma-separated allow-list of browser origins. Empty means no cross-origin access. |
| `HTTP_BODY_LIMIT`   | `1mb`                               | Maximum JSON body size (`100kb`, `1mb`, ...). Larger bodies get 413.               |
| `HTTP_TRUST_PROXY`  | `false`                             | Trust `X-Forwarded-*` headers. Enable only behind a trusted proxy.                 |
| `DOCS_ENABLED`      | `true` in development, else `false` | Serve the API reference UI at `/api/docs`.                                         |

## database

| Variable                   | Default  | Description                                                                   |
| -------------------------- | -------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`             | required | PostgreSQL URL used by the application (`postgres://user:pass@host:5432/db`). |
| `DB_POOL_MAX`              | `10`     | Maximum connections in the pool, per process.                                 |
| `DB_STATEMENT_TIMEOUT_MS`  | `30000`  | `statement_timeout` for every connection.                                     |
| `DB_IDLE_TIMEOUT_MS`       | `10000`  | Idle connections are closed after this time.                                  |
| `DB_CONNECTION_TIMEOUT_MS` | `5000`   | Maximum wait for a new connection.                                            |

Used only by tooling (not part of the application schema):

| Variable                                                             | Default                     | Description                                                     |
| -------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| `MIGRATION_DATABASE_URL`                                             | `DATABASE_URL`              | Connection used by `db/migrate.sh`. Use a role with DDL rights. |
| `POSTGRES_IMAGE`                                                     | `postgres:18-alpine`        | PostgreSQL image for Docker Compose and Testcontainers.         |
| `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `5432`, `app`, `app`, `app` | Local PostgreSQL container settings (Docker Compose).           |
| `KEYCLOAK_PORT`                                                      | `8080`                      | Local Keycloak port (Docker Compose profile `auth`).            |

## auth

| Variable                   | Default              | Description                                                                        |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `OIDC_ISSUER_URL`          | required             | Expected `iss` claim, for example `http://localhost:8080/realms/dev`.              |
| `OIDC_AUDIENCE`            | required             | Expected `aud` claim (the API's client id or audience).                            |
| `OIDC_JWKS_URL`            | discovered           | JWKS URL. When unset, it is read from `<issuer>/.well-known/openid-configuration`. |
| `OIDC_ROLES_CLAIM_PATH`    | `realm_access.roles` | Dot path to the roles array in the token (Keycloak: `realm_access.roles`).         |
| `OIDC_ALGORITHMS`          | `RS256`              | Comma-separated allowed signing algorithms.                                        |
| `OIDC_CLOCK_TOLERANCE_SEC` | `5`                  | Allowed clock skew when checking `exp` and `nbf`.                                  |

## jobs

| Variable                        | Default  | Description                                                                                                                    |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `JOBS_AUTO_MIGRATE`             | `true`   | Let pg-boss create and update its schema. Set `false` when the app role has no DDL rights (see `docs/guides/adding-a-job.md`). |
| `JOBS_SCHEMA`                   | `pgboss` | PostgreSQL schema used by pg-boss.                                                                                             |
| `JOBS_RETRY_LIMIT`              | `3`      | Default retries per job.                                                                                                       |
| `JOBS_RETRY_DELAY_SEC`          | `5`      | Default delay before a retry.                                                                                                  |
| `JOBS_RETRY_BACKOFF`            | `true`   | Exponential backoff between retries.                                                                                           |
| `JOBS_EXPIRE_SEC`               | `900`    | A job running longer than this is failed and retried.                                                                          |
| `JOBS_CONCURRENCY`              | `5`      | Default parallel jobs per queue in one worker.                                                                                 |
| `JOBS_QUEUE_DEPTH_INTERVAL_SEC` | `15`     | How often the worker samples queue depth for metrics.                                                                          |
| `WORKER_HTTP_PORT`              | `3001`   | Worker port for health checks.                                                                                                 |

## logging

| Variable     | Default                             | Description                                                                                   |
| ------------ | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `LOG_LEVEL`  | `info`                              | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                               |
| `LOG_PRETTY` | `true` in development, else `false` | Human-readable logs with `pino-pretty` (a dev dependency; never enable in production images). |

## telemetry

| Variable                      | Default    | Description                                                       |
| ----------------------------- | ---------- | ----------------------------------------------------------------- |
| `METRICS_ENABLED`             | `true`     | Expose Prometheus metrics.                                        |
| `METRICS_HOST`                | `0.0.0.0`  | Interface of the metrics endpoint.                                |
| `METRICS_PORT`                | `9464`     | API metrics port (`/metrics`). Never the public API port.         |
| `WORKER_METRICS_PORT`         | `9465`     | Worker metrics port.                                              |
| `OTEL_SERVICE_NAME`           | `APP_NAME` | `service.name` resource attribute.                                |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset      | OTLP/HTTP endpoint for traces and metrics. Unset means no export. |
| `OTEL_TRACES_SAMPLER_ARG`     | `1`        | Ratio for the parent-based trace sampler (0 to 1).                |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000`    | OTLP metric push interval in milliseconds.                        |
