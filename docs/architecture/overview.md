# Architecture overview

One repository, one Docker image, two processes:

- **API** (`src/main.ts`): HTTP on `HTTP_PORT` under `/api/v1/...`, probes on `/health/*`,
  metrics on `METRICS_PORT`.
- **Worker** (`src/worker.ts`): runs background jobs from pg-boss; probes on
  `WORKER_HTTP_PORT`, metrics on `WORKER_METRICS_PORT`; no API routes.

Both use PostgreSQL: application tables (schema `public`, owned by `db/migrations`) and the
pg-boss queue (schema `pgboss`).

```
            ┌──────────────────────── one image ────────────────────────┐
 client ──► │ API process                         Worker process        │
  (JWT)     │  /api/v1/* ──► controller           @JobHandler           │
            │                 └► service ──────►  └► service            │
            │                     ├► repository       └► repository     │
            │                     └► JobsService.enqueue                │
            └──────────┬──────────────────────────────────┬─────────────┘
                       ▼                                  ▼
               PostgreSQL: public.* (app tables)  +  pgboss.* (job queue)

 OIDC provider (Keycloak locally) ◄── JWKS ── API auth guard
 Prometheus ──scrape──► :9464/metrics (API), :9465/metrics (worker)
 OTLP collector ◄── traces/metrics (only if OTEL_EXPORTER_OTLP_ENDPOINT is set)
```

## Layers

| Layer        | Path                                                                       | Rules                                                                                                                   |
| ------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Entry points | `src/main.ts`, `src/worker.ts`, `src/instrumentation.ts`, `src/openapi.ts` | Bootstrap only.                                                                                                         |
| Config       | `src/config/`                                                              | The only code that reads `process.env`. Zod-validated.                                                                  |
| Core         | `src/core/`                                                                | Infrastructure (context, logging, http, auth, database, jobs, health, observability, errors). Never imports `modules/`. |
| Modules      | `src/modules/<name>/`                                                      | One feature each: controller → service → repository. Public API only through `index.ts`.                                |
| Shared       | `src/shared/`                                                              | Small pure helpers (ids, time, pagination). Imports nothing from the app.                                               |

Boundaries are enforced by ESLint (`eslint.config.mjs`).

## Request flow (API)

1. `instrumentation.ts` (loaded with `node --import`) has started OpenTelemetry: the
   incoming `traceparent` is continued or a new trace starts.
2. Middleware, in order: helmet and CORS → request context (AsyncLocalStorage; request id
   from `x-request-id` or a new UUIDv7, echoed in the response) → access log (pino-http) →
   HTTP metrics → JSON body parser (size limit).
3. Global **auth guard**: verifies the Bearer JWT against the issuer's JWKS, applies
   `@Roles()` and the `AuthorizationPolicy`; sets `userId` in the context. `@Public()` skips it.
4. Global **Zod validation pipe**: body, query and params against the DTO schemas.
5. Controller → service (business rules, authorization, `@Transactional()`) → repository
   (TypeORM through the transaction-aware manager). The transaction first runs the
   `DbSessionContext` hook.
6. **Zod serializer** validates the response against its schema.
7. Errors at any step reach the global **Problem Details filter**: domain errors and mapped
   PostgreSQL errors keep their status and code; anything else becomes a generic 500.
8. One access log line per request: method, route template, status, duration, request id,
   trace id.

## Job flow

1. A service calls `JobsService.enqueue(definition, payload)` inside its transaction. The
   payload is validated with the job's Zod schema and written to `pgboss.job` in the same
   transaction (and the current trace context is attached).
2. The worker polls the queue. For each job: a span (continuing the producer's trace), a
   job context (`jobId`, `queue` in every log line), payload validation, then the
   `@JobHandler` method.
3. Success completes the job. A thrown error fails the attempt; pg-boss retries with the
   job's retry settings. Metrics: processed, failed, retried, duration, queue depth.

## Startup and shutdown

- Startup fails fast with a list of invalid environment variables.
- Database migrations run before the app (`migrate` service / deploy step), never inside it.
- On SIGTERM: readiness turns 503, the HTTP server stops accepting and drains, pg-boss stops
  (active jobs may finish), the DataSource closes, telemetry flushes, the process exits;
  after `SHUTDOWN_TIMEOUT_MS` it exits with code 1.
