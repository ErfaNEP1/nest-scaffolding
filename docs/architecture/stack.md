# Stack and versions

Every dependency, its exact version and why it is here. Versions were checked against the
npm registry and Docker Hub on **2026-10-10** (latest stable, no pre-releases), approved,
and pinned exactly (`save-exact=true`, `pnpm-lock.yaml` committed).

A new runtime dependency needs a line here (and an ADR if it is an infrastructure piece).

## Runtime and images

| Item       | Version                                                     | Why                                                                                         |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Node.js    | 24.21.0 (Active LTS "Krypton"; `.nvmrc`, `engines >=24.11`) | Runtime. Node 26 becomes Active LTS around 2026-10-28: bump `.nvmrc` and `NODE_IMAGE` then. |
| pnpm       | 12.10.1 (`packageManager`, Corepack)                        | Package manager.                                                                            |
| Base image | `node:24.21.0-alpine3.24` (`NODE_IMAGE` build arg)          | Small runtime image, non-root `node` user.                                                  |
| PostgreSQL | `postgres:18-alpine` (`POSTGRES_IMAGE`)                     | Database; 19 is still beta. Also runs `db/migrate.sh` (psql) in Compose and Testcontainers. |
| Keycloak   | `quay.io/keycloak/keycloak:26.8.0` (`KEYCLOAK_IMAGE`)       | Local OIDC provider only (Compose profile `auth`).                                          |

## Runtime dependencies

| Package                                                                                                                         | Version                                    | Why                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| @nestjs/core, @nestjs/common, @nestjs/platform-express                                                                          | 12.1.2                                     | Framework with the Express adapter. NestJS 12 is ESM-only; our CommonJS build loads it with `require(esm)`. |
| express                                                                                                                         | 5.2.1                                      | The version Nest uses; imported for the `json()` body parser middleware.                                    |
| reflect-metadata                                                                                                                | 0.2.2                                      | Decorator metadata for Nest DI. Last release 2024-03, but finished and required by Nest.                    |
| rxjs                                                                                                                            | 7.8.2                                      | Peer dependency of Nest.                                                                                    |
| @nestjs/terminus                                                                                                                | 12.1.0                                     | Health checks.                                                                                              |
| @nestjs/typeorm                                                                                                                 | 12.0.2                                     | DataSource integration.                                                                                     |
| typeorm                                                                                                                         | 1.1.2                                      | Query layer only (no `synchronize`, no TypeORM migrations).                                                 |
| pg                                                                                                                              | 8.23.1                                     | PostgreSQL driver.                                                                                          |
| nestjs-cls                                                                                                                      | 7.0.1                                      | Request/job context (AsyncLocalStorage).                                                                    |
| @nestjs-cls/transactional                                                                                                       | 4.0.1                                      | `@Transactional()` and `TransactionHost`. The TypeORM adapter is our own (ADR 0002).                        |
| zod                                                                                                                             | 4.6.5                                      | Schemas for config, requests, responses, job payloads.                                                      |
| nestjs-zod                                                                                                                      | 5.5.0                                      | Zod DTOs, validation pipe, response serializer, OpenAPI integration.                                        |
| @nestjs/swagger                                                                                                                 | 12.0.2                                     | Builds the OpenAPI document (fed by nestjs-zod).                                                            |
| @scalar/nestjs-api-reference                                                                                                    | 1.2.28                                     | API reference UI at `/api/docs` when `DOCS_ENABLED=true`.                                                   |
| nestjs-pino, pino, pino-http                                                                                                    | 5.3.1 / 10.4.0 / 11.0.0                    | Structured logging and the access log.                                                                      |
| pg-boss                                                                                                                         | 12.37.1                                    | Job queue in PostgreSQL (no Redis).                                                                         |
| jose                                                                                                                            | 6.2.12                                     | OIDC JWT verification with remote JWKS.                                                                     |
| helmet                                                                                                                          | 8.3.0                                      | Security headers.                                                                                           |
| uuid                                                                                                                            | 14.0.3                                     | UUIDv7 ids (monotonic within a process).                                                                    |
| @opentelemetry/api                                                                                                              | 1.9.1                                      | Telemetry API (also used by pg-boss).                                                                       |
| @opentelemetry/sdk-trace-node, sdk-metrics, resources                                                                           | 2.12.0                                     | SDK (stable line). `sdk-node` is not used (ADR 0002).                                                       |
| @opentelemetry/semantic-conventions                                                                                             | 1.43.0                                     | Resource attribute names.                                                                                   |
| @opentelemetry/instrumentation, instrumentation-http, exporter-prometheus, exporter-trace-otlp-http, exporter-metrics-otlp-http | 0.223.0                                    | Instrumentation base and exporters (experimental line, same release as SDK 2.12.0).                         |
| @opentelemetry/instrumentation-express / -nestjs-core / -pg / -pino / -runtime-node                                             | 0.71.0 / 0.69.0 / 0.75.0 / 0.69.0 / 0.36.0 | Only these instrumentations (contrib release of 2026-10-06, built on instrumentation 0.223.0).              |

## Development dependencies

| Package                                          | Version                 | Why                                                                              |
| ------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------- |
| typescript                                       | 6.0.3                   | Type checking and `nest build`. 7.0.2 is not usable yet (see below).             |
| @types/node, @types/express, @types/supertest    | 24.19.2 / 5.0.6 / 7.2.1 | Types (Node types match Node 24).                                                |
| @nestjs/cli                                      | 12.0.8                  | `nest build` / `nest start --watch`.                                             |
| @swc/core, @swc/cli                              | 1.16.13 / 0.8.1         | Fast dev builds (`--builder swc`) and Vitest transforms with decorator metadata. |
| @nestjs/testing                                  | 12.1.2                  | Testing module.                                                                  |
| vitest, @vitest/coverage-v8                      | 5.0.3                   | Tests and coverage.                                                              |
| vite                                             | 8.3.4                   | Peer dependency of Vitest.                                                       |
| unplugin-swc                                     | 2.0.0                   | SWC in Vitest (decorator metadata).                                              |
| testcontainers, @testcontainers/postgresql       | 12.2.0                  | One PostgreSQL container per test run.                                           |
| supertest                                        | 7.3.1                   | HTTP assertions in tests.                                                        |
| eslint, @eslint/js                               | 10.12.0 / 10.0.1        | Linting (flat config).                                                           |
| typescript-eslint                                | 8.71.1                  | Type-checked rules (`strictTypeChecked`, `stylisticTypeChecked`).                |
| eslint-plugin-boundaries                         | 7.2.0                   | Architecture boundaries (core vs modules, module public API).                    |
| prettier                                         | 3.9.9                   | Formatting.                                                                      |
| husky, lint-staged                               | 9.1.7 / 17.6.0          | Git hooks on staged files.                                                       |
| @commitlint/cli, @commitlint/config-conventional | 21.2.3                  | Conventional Commits.                                                            |
| openapi-typescript                               | 7.13.0                  | Contract types from `openapi/openapi.json`.                                      |
| pino-pretty                                      | 13.2.0                  | Readable logs in local development only (not in the image).                      |

## Conflicts and decisions

1. **TypeScript 7.0.2 is `latest` but not usable.** It is the native (Go) compiler.
   typescript-eslint 8.71.1 requires `typescript <6.1.0`, `@nestjs/swagger` 12 requires
   `^5.5 || ^6` and the type-checked lint rules need the TypeScript JS API. **Chosen: 6.0.3.**
2. **nestjs-zod 5.5.0** declares peers `@nestjs/common ^10 || ^11` and `@nestjs/swagger ^11`
   (its last release predates NestJS 12). The project is active. Tested on NestJS 12.1.2 +
   swagger 12.0.2 + zod 4.6.5: validation, serialization and OpenAPI generation work.
   **Chosen (approved): NestJS 12 with `peerDependencyRules.allowedVersions` in
   `pnpm-workspace.yaml`.** Remove the exception when nestjs-zod declares NestJS 12.
3. **openapi-typescript 7.13.0** declares `typescript ^5.x`; works with 6.0.3. Same exception.
4. **eslint-config-prettier dropped** (no release for ~15 months): ESLint 10 core and
   typescript-eslint 8 no longer ship formatting rules, so nothing needs turning off.
5. **Not used:** `@opentelemetry/sdk-node` (ADR 0002), `@nestjs-cls/transactional-adapter-typeorm`
   (own adapter, ADR 0002), `tsx`/`ts-node` (SWC and build output instead),
   `eslint-plugin-import-x` (boundaries plugin covers it), `tini` (Node handles signals as PID 1).
6. **Build scripts** (pnpm 12 asks for approval): allowed for `@swc/core`; denied for
   `@scarf/scarf` (install analytics in swagger-ui-dist), `cpu-features`, `ssh2`,
   `protobufjs` (optional or not needed). See `allowBuilds` in `pnpm-workspace.yaml`.
