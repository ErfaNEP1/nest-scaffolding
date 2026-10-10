# 0002. Template baseline and deliberate deviations

- Status: Accepted
- Date: 2026-10-10
- Deciders: template maintainers

## Context

The template was built from a fixed list of decisions (NestJS on Express, TypeORM for
queries only, plain SQL migrations, Zod contract, pg-boss, generic OIDC, pino,
OpenTelemetry, Vitest). While building it, a few details had to differ from the original
brief to work correctly. They are recorded here so nobody "fixes" them back by accident.

## Decision

1. **TypeScript 6, not 7.** TypeScript 7 (native compiler) is not supported by
   typescript-eslint and `@nestjs/swagger` yet. See `stack.md`.
2. **nestjs-zod and openapi-typescript with NestJS 12 / TypeScript 6** although their
   declared peer ranges are older; allowed in `pnpm-workspace.yaml` (`peerDependencyRules`)
   after testing. Remove the exceptions when the packages update.
3. **Own TypeORM transaction adapter** (`core/database/transactional-adapter.ts`, about 20
   lines) instead of `@nestjs-cls/transactional-adapter-typeorm`, so the `DbSessionContext`
   hook runs at the start of every transaction.
4. **Own signal handling** (`core/lifecycle/shutdown.ts`) instead of
   `app.enableShutdownHooks()`: Nest's hook re-raises the signal right after the shutdown
   hooks and kills the process before buffered logs are written. Ours calls `app.close()`
   (the same hooks), flushes logs and exits, with a timeout.
5. **No `@opentelemetry/sdk-node`.** Providers are built explicitly so no exporter is
   created from `OTEL_*` defaults; without `OTEL_EXPORTER_OTLP_ENDPOINT` nothing is exported
   and no exporter errors appear.
6. **Jobs are declared with `defineJob()`** (queue + payload schema + retry options) and
   handled with `@JobHandler(definition)`, instead of passing queue and schema separately to
   `enqueue()` and `@JobHandler()`. Producer and consumer share one definition, so they cannot
   drift. `enqueue()` joins the current transaction.
7. **Worker without HTTP routing.** The worker is a Nest application context with a small
   probe server for `/health/*`; it loads the same feature modules but serves no API routes.
8. **No tini in the image.** Node runs as PID 1 and handles SIGTERM/SIGINT itself; Docker
   Compose adds `init: true`.
9. **JSON body parsing as Nest middleware** (not Express's global parser), so oversized or
   invalid bodies still get a request id, an access log line and Problem Details.

## Consequences

These choices are part of the template contract. Changing one needs a new ADR.
