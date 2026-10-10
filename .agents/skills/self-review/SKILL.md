---
name: self-review
description: Use before saying a task is done, to review your own change against the project rules. A checklist for boundaries, security, validation, errors, tests, docs, performance and pnpm verify.
---

# Self-review

Read your full diff (`git diff`, including new files) as a reviewer would. Fix what you find, then report.

## Checklist

**Scope**
- [ ] The change does what was asked and nothing else. No unrelated refactors, no dead or commented-out code, no TODO without a ticket id.

**Boundaries** (`AGENTS.md` §3)
- [ ] No import from another module's internal files; `core/` does not import `modules/`. `pnpm lint` passes.
- [ ] Controllers only map HTTP; rules and authorization are in services; repositories only query.

**Security**
- [ ] Endpoints are authenticated; any `@Public()` has a reason. Authorization is checked in the service for every resource.
- [ ] Input validated with Zod at the edge; responses have a schema and expose no internal fields.
- [ ] No secrets, tokens or personal data in logs, errors, job payloads or committed files.
- [ ] Parameterized SQL only.

**Errors**
- [ ] Domain errors with stable codes; no hand-built responses; nothing swallowed.

**Data**
- [ ] Schema changes are new migrations with matching entity changes; no edited applied migrations.
- [ ] Multi-write operations are `@Transactional()`; shared rows use `row_version`.
- [ ] No N+1 queries; lists are paginated and indexed.

**Jobs**
- [ ] Payload schema, ids only, idempotent handler, explicit retries.

**Observability**
- [ ] Meaningful `info` logs for business events; metrics via the helper, low-cardinality labels.

**Tests**
- [ ] Unit / integration / e2e as the `testing` skill says; deterministic; nothing skipped or weakened.

**Docs**
- [ ] Module README, CHANGELOG, configuration/observability docs, ADR if needed (`docs-and-changelog` skill).
- [ ] API changed → `pnpm openapi:generate` committed; breaking → major contract version + **BREAKING** entry.

**Verify**
- [ ] `pnpm verify` passes. Endpoints changed → `pnpm test:e2e` passes.

## Report

End with: what changed, how it was verified (commands and results), what was not done, open questions.
