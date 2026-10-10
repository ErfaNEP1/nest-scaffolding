# AGENTS.md

Rules for AI agents and developers working in this repository. Read this file fully before any change.

## 1. Sources of truth

- Read `docs/README.md` first. Business rules live in `docs/project/`, technical decisions in `docs/architecture/adr/`, conventions in `docs/api/`, `docs/database/`, `docs/operations/`.
- Precedence: `docs/project/` (what the system must do) > `docs/architecture/adr/` (technical decisions) > other `docs/` (conventions, guides) > `docs/plans/` (working plans) > code. Code follows docs.
- Before touching a module, read its `README.md` (`src/modules/<name>/README.md`).
- If the task, the docs and the code disagree, or two docs disagree, stop and report the conflict. Do not invent business rules.
- Before starting a task type that has a skill (section 12), read that skill.
- `src/modules/sample/` is the reference implementation of every convention. Copy its patterns.

## 2. Commands

| Task                                   | Command                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Install                                | `corepack enable && pnpm install`                                                      |
| Local stack (db, migrate, api, worker) | `docker compose up --build` (`--profile auth` adds Keycloak)                           |
| Run the API / the worker with watch    | `pnpm dev` / `pnpm dev:worker` (needs `.env` and a database)                           |
| Unit / integration / e2e tests         | `pnpm test:unit` / `pnpm test:int` / `pnpm test:e2e` (integration and e2e need Docker) |
| Lint / format / types                  | `pnpm lint` (`lint:fix`) / `pnpm format` / `pnpm typecheck`                            |
| Migrations                             | `pnpm db:new <name>`, `pnpm db:migrate`, `pnpm db:status`                              |
| API contract                           | `pnpm openapi:generate` (writes `openapi/openapi.json`), `pnpm contract:build`         |
| Everything that must pass              | `pnpm verify` (lint, format, types, unit, integration, OpenAPI up to date)             |

- Run `pnpm verify` before saying a task is done. Run `pnpm test:e2e` when endpoints changed.

## 3. Architecture

- `src/core/` = infrastructure only. `src/modules/<name>/` = one feature each. `src/shared/` = small pure helpers. `src/config/` = the only place that reads `process.env`.
- A module exposes its public API only through `index.ts`. Never import another module's internal files.
- `core/` never imports from `modules/`. These rules are enforced by ESLint (`eslint-plugin-boundaries`).
- Controller → service → repository. Controllers hold no business logic. Repositories hold no business rules.
- The worker (`src/worker.ts`) processes jobs; the API only enqueues them. Both load the modules listed in `src/feature-modules.ts`.
- Overview and request/job flow: `docs/architecture/overview.md`.

## 4. Code rules

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`, no `as` casts to silence errors, no `@ts-ignore` without a comment explaining why.
- No `console.*`. Use the injected logger (`@InjectPinoLogger(Name.name) private readonly logger: PinoLogger`).
- Read configuration only through `ConfigService`. Every new env var goes into `src/config/env.schema.ts` (and `config.ts`), `.env.example` and `docs/operations/configuration.md`. A test fails if one is missing.
- Files: kebab-case (`order-item.service.ts`). Classes: PascalCase. Database: snake_case. Use `now()` from `src/shared/time.ts` and `newId()` from `src/shared/ids.ts`.
- Small functions, early returns, no dead code, no commented-out code.
- Do not add a dependency without a reason. A new runtime dependency needs an ADR or a line in `docs/architecture/stack.md` with the reason. Pin exact versions.

## 5. API rules

- Every request body, query and response has a Zod schema (`createZodDto`, `@ZodResponse`). Validate input at the edge. Conventions: `docs/api/conventions.md`.
- Errors are Problem Details with a stable `code`. Throw domain errors (`src/core/errors`) from services; never build HTTP responses by hand. Document error statuses with `@ApiProblems(...)`.
- Endpoints are authenticated by default. `@Public()` needs a reason in a comment.
- Check authorization in the service for every resource access, not only roles in the controller.
- Lists use cursor pagination. IDs are UUIDv7. Dates are ISO-8601 UTC. Money is integer minor units plus currency code.
- After any API change, run `pnpm openapi:generate` and commit `openapi/openapi.json`. Breaking changes need a major contract version (`contract/package.json`) and a CHANGELOG entry marked **BREAKING**.

## 6. Database rules

- Schema changes only through new SQL files in `db/migrations/` (`pnpm db:new <name>`). Never edit a migration that may have been applied anywhere. Forward-only.
- Never use TypeORM `synchronize` or TypeORM migrations.
- Each migration does one logical change and comes with the matching entity change in the same commit.
- Parameterized queries only. No string-built SQL.
- Avoid N+1: no lazy relations, load what you need explicitly.
- Writes that must be atomic use `@Transactional()`. Updates on shared rows use `row_version` optimistic locking (`updateWithVersion`).
- Repositories use `TransactionHost<DbAdapter>` (`txHost.tx`), never the global `DataSource` manager. Conventions: `docs/database/conventions.md`.

## 7. Background jobs

- Every job is declared with `defineJob()` (queue `<module>.<action>`, Zod payload schema, explicit retry settings), is idempotent (safe to run twice) and is handled by one `@JobHandler()` method.
- Payloads carry ids, not whole objects or secrets.
- Enqueue from services inside the same `@Transactional()` as the data change. Guide: `docs/guides/adding-a-job.md`.

## 8. Logging and observability

- Structured logs: a short message plus fields. Never log secrets, tokens, passwords or full personal data.
- `error` = needs attention, `warn` = unexpected but handled, `info` = business-relevant events, `debug` = diagnostics.
- New metrics use the helper in `core/observability` (`createCounter`, `createHistogram`, ...). No high-cardinality labels (no ids, no raw URLs).
- Do not swallow errors. Either handle them with a clear outcome or let them reach the global filter.
- Details: `docs/operations/observability.md`.

## 9. Testing

- Every change ships with tests. Business logic → unit tests (`*.spec.ts` next to the code). Repository/SQL/transactions → integration tests (`test/integration/**/*.int-spec.ts`). Endpoints → e2e tests (`test/e2e/**/*.e2e-spec.ts`) for the main path and the main error cases.
- Helpers in `test/support/`: `createTestApp`, `createTestWorker`, `TestIssuer` (tokens), `truncateAll`, factories, `waitFor`.
- Tests are deterministic: no real network, no sleeps (use `waitFor`), no dependence on order.
- Do not delete or weaken a failing test to make the build pass. Fix the cause or report it.

## 10. Documentation rules

### README files

- Root `README.md`: what the service is, requirements, quick start, scripts, configuration pointer, project structure, links into `docs/`. Keep it current when scripts, setup or structure change.
- Every module has `src/modules/<name>/README.md` with: purpose, public API (exports), endpoints, jobs it enqueues or handles, tables it owns, events/integrations, config keys. Update it in the same change as the code.
- Write for a new developer: short sentences, real commands, no marketing.

### CHANGELOG.md

- Format: Keep a Changelog. Versioning: SemVer.
- Every change visible to API consumers, operators or other developers adds a line under `## [Unreleased]` in the same commit, in one of: Added, Changed, Deprecated, Removed, Fixed, Security.
- One line per change, written for the reader (what changed and its effect), with the ticket id if there is one. Breaking changes start with **BREAKING:** and say what consumers must do.
- Internal refactors with no visible effect do not need an entry.
- Releasing moves `Unreleased` into a dated version section. Never rewrite released sections.

### ADRs

- Write an ADR (`docs/architecture/adr/NNNN-title.md`, from `0000-template.md`) for: a new runtime dependency or infrastructure piece, a change to a cross-cutting pattern, or any deviation from these rules. Status: Proposed → Accepted / Superseded.

### Other docs

- New env var → `docs/operations/configuration.md`. New metric or log field → `docs/operations/observability.md`. Changed convention → the matching file in `docs/`.
- Code comments explain _why_, not _what_. Public functions in `core/` have a short TSDoc comment.

## 11. Git

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`; `!` for breaking). Scope = module name. Subject in lower case. Enforced by commitlint.
- Small, focused commits. Code, tests, docs and CHANGELOG for one change go together.
- Never commit secrets, `.env` files or generated build output (except `openapi/openapi.json`).

## 12. Skills

Skills live in `.agents/skills/<name>/SKILL.md` (the only real copy; `.claude/skills` is a symlink). Wiring per tool: `docs/guides/ai-agents.md`.

| Skill                | Use when                       |
| -------------------- | ------------------------------ |
| `new-module`         | Creating a feature module      |
| `api-endpoint`       | Adding or changing an endpoint |
| `database-migration` | Any schema change              |
| `data-access`        | Writing repository code        |
| `background-job`     | Adding a job                   |
| `testing`            | Writing tests                  |
| `observability`      | Adding logs, metrics or spans  |
| `docs-and-changelog` | Finishing any change           |
| `self-review`        | Before saying a task is done   |

Third-party skills (vendored copies, listed with source and license in `.agents/skills/THIRD_PARTY.md`):

| Skill                                                                       | Use when                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `test-driven-development`                                                   | Implementing a feature or bug fix (test first)                     |
| `systematic-debugging`                                                      | A bug, failing test or unexpected behavior, before proposing fixes |
| `verification-before-completion`                                            | Before claiming anything works or is done                          |
| `writing-plans` / `executing-plans`                                         | Multi-step changes: write a plan, then carry it out step by step   |
| `grill-me` (with `grilling`)                                                | Stress-testing a plan or design through questions                  |
| `improve-codebase-architecture` (with `codebase-design`, `domain-modeling`) | Looking for structural improvements                                |
| `supabase-postgres-best-practices`                                          | General PostgreSQL advice (indexes, locking, RLS, pooling)         |
| `skill-creator`                                                             | Writing or improving our own skills                                |
| `find-skills`                                                               | Searching for a skill we do not have (search and suggest only)     |

### Project overrides

Third-party skills are general advice; where they conflict with this file or our skills,
**our rules win**. Known conflicts:

- **All third-party skills:** use `pnpm` scripts (`pnpm test:unit`, `pnpm verify`), not `npm test`/`pytest`; Vitest, not Jest; the injected pino logger, never `console.*` (temporary debug output is never committed; lint blocks it). Ignore references to skills that are not in `.agents/skills/` (for example `superpowers:using-git-worktrees`, `subagent-driven-development`, `finishing-a-development-branch`).
- **test-driven-development:** test-first is encouraged. "Delete code written before the test" applies only to your own uncommitted work in the current task, never to existing code.
- **writing-plans / executing-plans:** save plans in `docs/plans/YYYY-MM-DD-<feature>.md` (not `docs/superpowers/plans/`). Plans are working documents with the lowest precedence (`docs/README.md`). The executing-plans helper scripts are removed: keep the ledger by hand. "Rulings, not stalls" does not apply to conflicts between the task, `docs/` and code, or to anything in section 14: stop and report those.
- **systematic-debugging:** `find-polluter.sh` is removed; bisect tests with `pnpm exec vitest run <file>`.
- **improve-codebase-architecture / codebase-design / domain-modeling:** present candidates as Markdown in the conversation; do not generate HTML reports, load CDN scripts or open a browser. The glossary lives in `docs/project/glossary.md` (not a root `GLOSSARY.md`); ADRs live in `docs/architecture/adr/` and use our template. Architecture terms ("module", "seam") are for discussion; our layout rules (section 3) stay.
- **supabase-postgres-best-practices:** ids are UUIDv7 generated by the application (no `pg_uuidv7`, no identity columns for exposed ids); money is integer minor units, not `numeric`; never `ALTER SYSTEM` or server settings in migrations; RLS settings go through `DbSessionContext` with transaction-local `set_config(..., true)`, not session-level `SET`; ignore Supabase-only parts (`auth.uid()`, roles `anon`/`authenticated`); new extensions need approval.
- **skill-creator:** its eval scripts and viewer are removed; review test runs in the conversation. Keep skill workspaces outside the repository. Our skill rules apply: `name` equals the folder name, portable frontmatter fields only, `pnpm skills:sync --check` passes.
- **find-skills:** may only search and suggest. When a useful skill is found, stop and report its name, source repository, install count, audit status on skills.sh and why it fits. Never run `npx skills add`, never install globally, and never use a skill that is not in `.agents/skills/`. A developer decides; adding it follows `docs/guides/ai-agents.md`. Prefer original, well-known publishers.

## 13. Definition of done

- [ ] `pnpm verify` passes (and `pnpm test:e2e` if endpoints changed).
- [ ] Tests added or updated.
- [ ] OpenAPI regenerated if the API changed.
- [ ] Module README, CHANGELOG and affected docs updated.
- [ ] No new warnings, no TODOs without a ticket id.
- [ ] Summary of what changed, what was not done, and any open questions.

## 14. Stop and ask when

- Docs are missing, unclear or contradict each other.
- The change needs a new dependency, a new infrastructure piece or a breaking API/DB change.
- A migration would rewrite or delete data.
- You are about to weaken security (auth, validation, logging redaction).
