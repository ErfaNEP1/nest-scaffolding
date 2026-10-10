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
- Background jobs with pg-boss: `defineJob()` (queue, Zod payload schema, retry settings), `JobsService.enqueue()` (validates the payload and joins the current transaction), `@JobHandler()` methods run by a separate worker process (`src/worker.ts`, same image) with job context, a span per job, retries and metrics (`jobs_processed_total`, `jobs_retried_total`, `jobs_duration`, `jobs_queue_depth`).
- Worker health probes on `WORKER_HTTP_PORT` and metrics on `WORKER_METRICS_PORT`; `pnpm jobs:schema-sql` prints the pg-boss schema as a migration for databases where the app role has no DDL rights (`JOBS_AUTO_MIGRATE=false`).
- API contract: Zod DTOs (`nestjs-zod`) validate requests (400 Problem Details with `errors[]`) and serialize responses; `pnpm openapi:generate` writes `openapi/openapi.json` without a database and `pnpm verify` fails when it is out of date; the `contract/` package (`{{NPM_SCOPE}}/api-contract`) ships the document and TypeScript types (`pnpm contract:build`, `pnpm contract:publish`).
- API reference UI (Scalar) at `/api/docs` when `DOCS_ENABLED=true`.
- Removable sample module (`src/modules/sample`) with `samples` table, CRUD endpoints under `/api/v1/samples` (cursor pagination, optimistic locking), the `sample.process` job, a custom metric and unit, integration and e2e tests.
- Multi-stage `Dockerfile` (one non-root image; `api` or `worker` command) and `docker-compose.yml` for local development (`postgres`, one-shot `migrate`, `api`, `worker`, and `keycloak` under the `auth` profile).
- `pnpm template:init --name <name> --scope <@scope> [--remove-sample]` replaces placeholders, resets the changelog and versions and can remove the sample module.
- `AGENTS.md` as the single rule file for people and AI agents (Claude Code via `CLAUDE.md`, Cursor via `.cursor/rules/000-agents.mdc`, Codex natively), nine project skills in `.agents/skills/` (linked as `.claude/skills`) and `pnpm skills:sync`.
- Documentation in `docs/`: index and precedence rules, architecture overview, stack, ADRs, API and database conventions, configuration, observability, runbook and guides.
- Vendored third-party agent skills (obra/superpowers, mattpocock/skills, supabase/agent-skills, anthropics/skills, vercel-labs/skills; see `.agents/skills/THIRD_PARTY.md`) with project overrides in `AGENTS.md`, and `docs/plans/` for implementation plans.
- Keycloak dev user `bob` has the role `viewer` (signed in, but no access to the sample endpoints) so the 403 case can be tried locally.

### Fixed

- Health probes now also return `x-request-id` (the request context middleware runs for every route, not only under `/api`).
- `.env.example` no longer overrides the version and commit set by the image build (`build_info`).
- `pnpm template:init` no longer fails on the `.claude/skills` symlink.
