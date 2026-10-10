# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project skeleton: NestJS 12 on Node.js 24, pnpm, strict TypeScript 6, ESLint with architecture boundary rules, Prettier, Vitest (unit, integration, e2e projects), husky, lint-staged and commitlint.
- Zod-validated configuration (`src/config`) that fails at startup with a list of invalid variables; every variable is documented in `docs/operations/configuration.md` and `.env.example`.
- Request context with AsyncLocalStorage (`requestId`, `userId`, `jobId`, `queue`) and `x-request-id` handling.
- Structured JSON logging with pino: one access log line per request (route template, status, duration), redaction of credentials at any depth, pretty output in development.
- RFC 9457 Problem Details for all errors, domain error classes (`NotFoundError`, `ConflictError`, `ForbiddenError`, `ValidationError`) and a global exception filter that never leaks internals.
- HTTP basics: `/api` prefix with URI versioning, helmet, CORS allow-list, JSON body limit and graceful shutdown with a timeout.
- Forward-only SQL migrations: `db/migrate.sh` (checksums, advisory lock, one transaction per file, `--dry-run`, `--status`) and `pnpm db:new` / `db:migrate` / `db:status`.
- TypeORM data access (queries only) with snake_case naming, pool and timeout settings, `@Transactional()` with a `DbSessionContext` hook for session settings such as row-level security, an optimistic locking helper and PostgreSQL error mapping (unique and foreign key violations → 409, serialization failures → retryable 409).
- Testcontainers setup: one PostgreSQL container per test run, migrated with `db/migrate.sh`.
- Health checks with `@nestjs/terminus`: `GET /health/live` and `GET /health/ready` (database, shutdown state), outside `/api` and not access-logged.
- OpenTelemetry: Prometheus metrics on a separate port (`METRICS_PORT`, default 9464) with HTTP (route template, status class), Node.js runtime, PostgreSQL pool and query duration and `build_info`; traces exported over OTLP only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; `traceId` and `spanId` in every log line; `traceparent` propagation.
- Metric helper (`core/observability/metrics.ts`) that enforces metric naming and rejects high-cardinality labels.
- Generic OIDC authentication: a global guard verifies Bearer JWTs against the issuer's JWKS (issuer, audience, expiry, algorithms), `@Public()`, `@Roles()`, `@CurrentUser()` and an `AuthorizationPolicy` extension point. Missing or invalid tokens get 401 Problem Details, missing roles 403.
- Keycloak dev realm (`docker/keycloak/dev-realm.json`) with a public and a confidential client and two test users, for the Docker Compose `auth` profile.
