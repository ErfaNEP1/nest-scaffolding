# Stack and versions

> **Status: approved 2026-10-10.** Versions checked against the npm registry and Docker Hub on **2026-10-10**.
> All npm versions are pinned exactly (`save-exact=true`).

## Runtime and images

| Item             | Version                                    | Why                                               | Notes                                                                                |
| ---------------- | ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Node.js          | 24.21.0 (Active LTS "Krypton")             | Runtime                                           | Node 26 becomes Active LTS around 2026-10-28; bump `.nvmrc` and the base image then. |
| pnpm             | 12.10.1                                    | Package manager (Corepack, `packageManager`)      |                                                                                      |
| Base image       | `node:24-alpine` (pinned to the patch tag) | Small runtime image                               |                                                                                      |
| PostgreSQL image | `postgres:18-alpine` (`POSTGRES_IMAGE`)    | Database                                          | 19 is still beta (`19beta4`), so 18 is the latest stable major.                      |
| Keycloak image   | `quay.io/keycloak/keycloak:26.8.0`         | Local OIDC provider (Compose profile `auth` only) |                                                                                      |

## Runtime dependencies

| Package                                                                                                                  | Version                                    | Why                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| @nestjs/core, @nestjs/common, @nestjs/platform-express                                                                   | 12.1.2                                     | Framework, Express adapter (Express 5.2.1)                                               |
| @nestjs/terminus                                                                                                         | 12.1.0                                     | Health checks                                                                            |
| @nestjs/typeorm                                                                                                          | 12.0.2                                     | DataSource integration                                                                   |
| @nestjs/swagger                                                                                                          | 12.0.2                                     | OpenAPI document generation (fed by nestjs-zod)                                          |
| typeorm                                                                                                                  | 1.1.2                                      | Query layer only (no sync, no migrations)                                                |
| pg                                                                                                                       | 8.23.1                                     | PostgreSQL driver                                                                        |
| reflect-metadata                                                                                                         | 0.2.2                                      | Decorator metadata required by Nest                                                      |
| rxjs                                                                                                                     | 7.8.2                                      | Required by Nest                                                                         |
| zod                                                                                                                      | 4.6.5                                      | Schemas for config, requests, responses, job payloads                                    |
| nestjs-zod                                                                                                               | 5.5.0                                      | Zod DTOs, validation pipe, OpenAPI integration (see conflict 2)                          |
| nestjs-pino, pino, pino-http                                                                                             | 5.3.1 / 10.4.0 / 11.0.0                    | Logging                                                                                  |
| nestjs-cls, @nestjs-cls/transactional, @nestjs-cls/transactional-adapter-typeorm                                         | 7.0.1 / 4.0.1 / 2.0.1                      | Request/job context and `@Transactional()`                                               |
| pg-boss                                                                                                                  | 12.37.1                                    | Jobs queue in PostgreSQL                                                                 |
| jose                                                                                                                     | 6.2.12                                     | OIDC JWT verification (JWKS)                                                             |
| helmet                                                                                                                   | 8.3.0                                      | Security headers                                                                         |
| uuid                                                                                                                     | 14.0.3                                     | UUIDv7 ids (monotonic)                                                                   |
| @scalar/nestjs-api-reference                                                                                             | 1.2.28                                     | API docs UI when `DOCS_ENABLED=true`                                                     |
| @opentelemetry/api                                                                                                       | 1.9.1                                      | Telemetry API                                                                            |
| @opentelemetry/sdk-node, exporter-prometheus, exporter-trace-otlp-http, exporter-metrics-otlp-http, instrumentation-http | 0.223.0                                    | SDK, exporters (experimental line)                                                       |
| @opentelemetry/sdk-metrics, sdk-trace-base, resources, core                                                              | 2.12.0                                     | SDK (stable line, same release as 0.223.0)                                               |
| @opentelemetry/semantic-conventions                                                                                      | 1.43.0                                     | Attribute names                                                                          |
| @opentelemetry/instrumentation-express / -nestjs-core / -pg / -pino / -runtime-node                                      | 0.71.0 / 0.69.0 / 0.75.0 / 0.69.0 / 0.36.0 | Selected instrumentations only (all depend on `@opentelemetry/instrumentation@^0.223.0`) |

## Development dependencies

| Package                                                     | Version                                                   | Why                                  |
| ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| typescript                                                  | 6.0.3                                                     | Type checking (see conflict 1)       |
| @types/node / @types/express / @types/pg / @types/supertest | 24.x latest (matched to Node 24) / 5.0.6 / 8.23.1 / 7.2.1 | Types                                |
| @nestjs/cli, @nestjs/schematics, @nestjs/testing            | 12.0.8 / 12.0.6 / 12.1.2                                  | Build (SWC builder), testing module  |
| @swc/core, @swc/cli                                         | 1.16.13 / 0.8.1                                           | Fast compile with decorator metadata |
| vitest, @vitest/coverage-v8                                 | 5.0.3                                                     | Tests, coverage                      |
| vite                                                        | 8.3.4                                                     | Vitest peer                          |
| unplugin-swc                                                | 2.0.0                                                     | Decorator metadata in Vitest         |
| testcontainers, @testcontainers/postgresql                  | 12.2.0                                                    | Integration/e2e database             |
| supertest                                                   | 7.3.1                                                     | e2e HTTP                             |
| eslint, @eslint/js                                          | 10.12.0 / 10.0.1                                          | Lint                                 |
| typescript-eslint                                           | 8.71.1                                                    | Type-checked rules                   |
| eslint-plugin-boundaries                                    | 7.2.0                                                     | Module boundary rules                |
| prettier                                                    | 3.9.9                                                     | Format                               |
| husky, lint-staged                                          | 9.1.7 / 17.6.0                                            | Git hooks                            |
| @commitlint/cli, @commitlint/config-conventional            | 21.2.3                                                    | Conventional Commits                 |
| openapi-typescript                                          | 7.13.0                                                    | Contract types from `openapi.json`   |
| pino-pretty                                                 | 13.2.0                                                    | Local dev log output only            |

## Conflicts and decisions

1. **TypeScript 7.0.2 is `latest` but cannot be used.** It is the native (Go) compiler. `typescript-eslint` 8.71.1 requires `typescript <6.1.0`, `@nestjs/swagger` 12 requires `^5.5 || ^6`, and the type-checked lint rules need the TypeScript JS API. **Chosen: 6.0.3**, the newest compatible release.
2. **nestjs-zod 5.5.0 declares peers `@nestjs/common ^10 || ^11` and `@nestjs/swagger ^11`.** Its last release (2026-07-25) is older than Nest 12 (2026-08-27). The project is active, not abandoned. A smoke test on Nest 12.1.2 + swagger 12.0.2 + zod 4.6.5 passed: validation (400 with issues), response serialization and OpenAPI schema generation all worked. Options:
   - **A (chosen):** Nest 12, plus a `pnpm.peerDependencyRules.allowedVersions` entry for nestjs-zod, documented here. Remove it when nestjs-zod publishes Nest 12 peers.
   - B: Nest 11.2.7 + swagger 11.4.7, with no peer warnings, but one major behind.
   - C: Nest 12 without nestjs-zod: our own Zod pipe plus `z.toJSONSchema()` wired into the OpenAPI document. More code to maintain.
3. **openapi-typescript 7.13.0 declares peer `typescript ^5.x`.** Tested with 6.0.3, and generation works. Allowed through `peerDependencyRules`, same as item 2.
4. **eslint-config-prettier (last release 2025-07, ~15 months ago): dropped.** ESLint 10 core and typescript-eslint 8 no longer ship formatting rules, so nothing needs to be turned off. Prettier runs separately.
5. **reflect-metadata (last release 2024-03)** is a finished, stable polyfill that Nest requires. It stays.
6. **No `tsx` / `ts-node`.** Dev uses `nest start --watch` with the SWC builder. Scripts are `.mjs` or run against the build output.
7. **`eslint-plugin-import-x` not needed.** Boundaries are covered by `eslint-plugin-boundaries` and `no-restricted-imports`.
