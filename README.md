# {{PROJECT_NAME}}

Backend service for {{PROJECT_NAME}}, built from the NestJS backend template: a REST API
and a background worker on PostgreSQL, with OIDC authentication, an OpenAPI contract
package and OpenTelemetry observability.

Rules for developers and AI agents: [`AGENTS.md`](AGENTS.md). Documentation:
[`docs/README.md`](docs/README.md).

## Requirements

- Node.js 24 (see `.nvmrc`)
- pnpm through Corepack: `corepack enable`
- Docker with Compose (local stack, integration and e2e tests)

## Quick start

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up --build            # postgres -> migrate -> api + worker
curl localhost:3000/health/ready
```

- API: `http://localhost:3000/api/v1/...`, reference UI at `http://localhost:3000/api/docs`
- Worker probes: `http://localhost:3001/health/ready`
- Metrics: `http://localhost:9464/metrics` (API), `http://localhost:9465/metrics` (worker)

New project from this template: `pnpm template:init --name <name> --scope <@scope>`
(see [getting started](docs/guides/getting-started.md)).

### Get a token (Keycloak dev realm)

```bash
docker compose --profile auth up -d                 # adds Keycloak on :8080
TOKEN=$(curl -s -d grant_type=password -d client_id=web -d username=alice -d password=alice \
  http://localhost:8080/realms/dev/protocol/openid-connect/token | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/samples
```

Users `alice`/`alice` (roles `user`, `admin`) and `bob`/`bob` (role `viewer`: signed in but not allowed to use the sample endpoints, so you get 403). Machine client:
`curl -s -d grant_type=client_credentials -d client_id=service -d client_secret=service-secret ...`.

## Scripts

| Script                              | What it does                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | API with watch mode (SWC), loads `.env`.                                                                        |
| `pnpm dev:worker`                   | Worker with watch mode.                                                                                         |
| `pnpm build`                        | Compile `src/` to `dist/` with `tsc`.                                                                           |
| `pnpm start` / `pnpm start:worker`  | Run the compiled API / worker (with OpenTelemetry).                                                             |
| `pnpm lint` / `pnpm lint:fix`       | ESLint, including architecture boundary rules.                                                                  |
| `pnpm format` / `pnpm format:check` | Prettier.                                                                                                       |
| `pnpm typecheck`                    | Type-check the whole repository.                                                                                |
| `pnpm test` / `pnpm test:unit`      | Unit tests (`src/**/*.spec.ts`).                                                                                |
| `pnpm test:int`                     | Integration tests (`test/integration`, PostgreSQL via Testcontainers; needs Docker).                            |
| `pnpm test:e2e`                     | End-to-end tests (`test/e2e`, needs Docker).                                                                    |
| `pnpm test:cov`                     | Unit tests with coverage thresholds.                                                                            |
| `pnpm db:migrate`                   | Apply pending migrations to the Docker Compose database.                                                        |
| `pnpm db:status`                    | Show applied and pending migrations.                                                                            |
| `pnpm db:new <name>`                | Create the next migration file in `db/migrations/`.                                                             |
| `pnpm openapi:generate`             | Write `openapi/openapi.json` from the code (no database needed).                                                |
| `pnpm openapi:check`                | Fail if `openapi/openapi.json` is out of date.                                                                  |
| `pnpm contract:build`               | Build the `contract/` package (OpenAPI JSON + TypeScript types).                                                |
| `pnpm contract:publish`             | Build and publish the contract to the registry in `.npmrc`.                                                     |
| `pnpm jobs:schema-sql`              | Print the pg-boss schema SQL (for `JOBS_AUTO_MIGRATE=false`).                                                   |
| `pnpm skills:sync`                  | Check and repair the AI skill wiring (`.claude/skills` link).                                                   |
| `pnpm template:init`                | Initialize a project from the template (placeholders, versions, sample removal).                                |
| `pnpm verify`                       | Lint, format, types, skills, unit and integration tests, OpenAPI up to date. Must pass before a change is done. |

## Configuration

All settings are environment variables, validated at startup. Local defaults:
`.env.example`. Reference: [`docs/operations/configuration.md`](docs/operations/configuration.md).

## Project structure

```
src/
  main.ts, worker.ts          API and worker entrypoints (same image)
  instrumentation.ts          OpenTelemetry, loaded with node --import
  app.module.ts, worker.module.ts, feature-modules.ts
  config/                     Zod-validated environment, ConfigService
  core/                       infrastructure: context, logging, http, errors, auth,
                              database, jobs, health, observability, lifecycle
  shared/                     pure helpers (ids, time, pagination)
  modules/<name>/             one feature each (sample = removable reference)
db/                           SQL migrations and migrate.sh
test/                         integration, e2e, support helpers
contract/                     publishable API contract package
openapi/openapi.json          generated OpenAPI document (committed)
docker/                       entrypoint, Keycloak dev realm
docs/                         source of truth (business, decisions, conventions, guides)
.agents/skills/               AI agent skills (.claude/skills links here)
```

## Documentation

- [Architecture overview](docs/architecture/overview.md) and [stack](docs/architecture/stack.md)
- [API conventions](docs/api/conventions.md), [database conventions](docs/database/conventions.md)
- [Observability](docs/operations/observability.md), [runbook](docs/operations/runbook.md)
- Guides: [getting started](docs/guides/getting-started.md),
  [adding a module](docs/guides/adding-a-module.md),
  [an endpoint](docs/guides/adding-an-endpoint.md),
  [a migration](docs/guides/adding-a-migration.md),
  [a job](docs/guides/adding-a-job.md),
  [AI agents](docs/guides/ai-agents.md),
  [removing the sample module](docs/guides/removing-the-sample-module.md)
- [Changelog](CHANGELOG.md)
