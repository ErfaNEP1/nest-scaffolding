---
name: new-module
description: Use when creating a new feature module under src/modules/<name> (a new business area with its own tables, endpoints or jobs). Covers folder layout, the index.ts public API, registration, the module README and which tests and docs to add.
---

# New module

Reference implementation: `src/modules/sample/`. Copy its shape, not its business logic.

## 1. Check first

- The business rules are in `docs/project/`. If they are missing or unclear, stop and ask.
- Pick a singular kebab-case name (`order`, `customer-note`). Queues and metrics use it as prefix.

## 2. Layout

```
src/modules/<name>/
  README.md                  # from templates/README.md (required)
  index.ts                   # public API: the only file other modules import
  <name>.module.ts
  <name>.controller.ts       # HTTP mapping only
  <name>.service.ts          # business rules + authorization
  <name>.service.spec.ts     # unit tests
  <name>.repository.ts       # TypeORM queries via TransactionHost<DbAdapter>
  <name>.entity.ts
  <name>.dto.ts              # Zod schemas + createZodDto classes + toXxxResponse()
  <name>.errors.ts           # DomainError subclasses with stable codes
  <name>.jobs.ts             # defineJob(...) (if any)
  <name>.job-handler.ts      # @JobHandler methods (if any)
  <name>.metrics.ts          # custom metrics (if any)
```

Not every file is needed. Do not create empty files.

## 3. Wire it

1. `<name>.module.ts`: `TypeOrmModule.forFeature([Entity])`, controllers, providers; export only what other modules need.
2. `index.ts`: export the module and the few services/types other modules may use. Nothing else.
3. Register the module in `src/feature-modules.ts` (loaded by both API and worker).
4. Tables: follow the `database-migration` skill (`pnpm db:new <name>_init`).
5. Endpoints: follow the `api-endpoint` skill. Jobs: `background-job` skill.

## 4. Tests

- Unit: service rules and authorization (`unitTestContextModule()` for `@Transactional()`), see `sample.service.spec.ts`.
- Integration: repository queries in `test/integration/<name>/`.
- E2E: main path + main errors in `test/e2e/<name>.e2e-spec.ts`.

## 5. Docs

- `src/modules/<name>/README.md` from `templates/README.md`, every section filled.
- `CHANGELOG.md` under `[Unreleased]`, new env vars in `docs/operations/configuration.md`, new metrics in `docs/operations/observability.md`.
- Finish with the `self-review` skill.
