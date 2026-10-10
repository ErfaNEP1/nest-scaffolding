---
name: testing
description: Use when writing or fixing tests. Explains which test type to write (unit, integration, e2e), the helpers in test/support (app factory, worker factory, token issuer, factories, truncate, waitFor), Testcontainers and how to keep tests deterministic.
---

# Testing

Vitest with SWC. Config: `vitest.config.mts` (projects `unit`, `integration`, `e2e`).

## Which test

| Change | Test | Location | Run |
|---|---|---|---|
| Business rule, mapping, pure function | Unit | `src/**/<file>.spec.ts` next to the code | `pnpm test:unit` |
| Repository, SQL, transaction, migration, job runner | Integration (real PostgreSQL) | `test/integration/**/*.int-spec.ts` | `pnpm test:int` |
| Endpoint (status, body, auth, errors) | E2E (whole app over HTTP) | `test/e2e/**/*.e2e-spec.ts` | `pnpm test:e2e` |

Every change ships with tests. Endpoints: main path + 400/401/403/404/409 where they apply.

## Helpers (`test/support/`)

- `testConfig(overrides)`: valid config for tests (`LOG_LEVEL=silent`, metrics off).
- `unitTestContextModule()`: lets `@Transactional()` services run in unit tests without a database.
- `createTestApp(env)`: the real API (same modules and HTTP setup as production) against the test DB.
- `createTestWorker(env)`: the real worker in-process, for job tests.
- `TestIssuer`: local RS256 key + JWKS server. `issuer.env()` points the app at it; `issuer.token({ subject, roles })` signs tokens. Also wrong audience/issuer/expired tokens.
- `truncateAll(dataSource)` in `beforeEach`; factories like `createSample(dataSource, overrides)`.
- `waitFor(check)`: poll an async outcome (jobs) instead of sleeping.

## Testcontainers

Integration and e2e start one PostgreSQL container per run (`test/support/postgres.global-setup.ts`) and apply `db/migrations` by running `db/migrate.sh` inside it. Tests read the URL with `inject('databaseUrl')`. Docker must be running. `POSTGRES_IMAGE` selects the version.

## Deterministic

- No real network (local JWKS server only), no `setTimeout` waits, no dependence on test order or on data from other tests.
- Unique values per test when tables are shared; truncate between tests.
- Wait for background workers before asserting on rows they change (see the optimistic locking e2e test).
- Mock at module boundaries (repositories, `JobsService`), not inside the unit under test.

## Never

Delete, skip or weaken a failing test to make the build pass. Fix the cause or report it.

## Coverage

`pnpm test:cov` (unit). Thresholds in `vitest.config.mts`: 70% lines/functions/statements, 60% branches on `src/`. Raise them over time; do not lower them.
