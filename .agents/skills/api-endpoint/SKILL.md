---
name: api-endpoint
description: Use when adding or changing an HTTP endpoint (controller method, request/response schema, query parameters, error responses). Covers Zod DTOs, auth and roles, authorization in the service, domain errors, pagination, OpenAPI regeneration, contract versioning and e2e tests.
---

# API endpoint

Conventions: `docs/api/conventions.md`. Example: `src/modules/sample/sample.controller.ts` and `sample.dto.ts`.

## Steps

1. **Schemas** in `<module>.dto.ts` with Zod, then `class X extends createZodDto(schema) {}`:
   - request body, query (`z.coerce` for numbers), path params (`z.uuid()` for ids), response.
   - Responses expose only what clients need (no `ownerId`, no internal fields). Map entities with a `toXxxResponse()` function.
   - Dates: `z.iso.datetime()` strings in UTC. Money: integer minor units + ISO currency code.
2. **Controller**: route under `@Controller({ path: '<plural>', version: '1' })`.
   - `@ZodResponse({ status, description, type })` on every method (validates and documents the response).
   - `@ApiProblems(400, 401, 403, 404, 409)` for the errors it can return.
   - `@Roles(...)` for coarse role checks; `@CurrentUser()` for the principal.
   - No business logic: call one service method and map the result.
3. **Authentication**: on by default. `@Public()` only with a comment saying why.
4. **Authorization**: in the service, for every resource access (ownership, tenant, state). Hide resources the caller may not see with 404, deny actions on visible ones with 403 (`ForbiddenError`).
5. **Errors**: throw domain errors (`NotFoundError`, `ConflictError`, `ForbiddenError`, `ValidationError` or a module subclass with a stable `UPPER_SNAKE` code). Never build responses by hand.
6. **Lists**: cursor pagination `{ items, nextCursor }` with `limit` (1–100) and `cursor`; keyset on a stable order (see `SampleRepository.list`).
7. **Updates** of shared rows: require `rowVersion` in the body; `409 VERSION_CONFLICT` on mismatch.
8. **Contract**: `pnpm openapi:generate`, commit `openapi/openapi.json`.
   - Breaking change (removed/renamed field or endpoint, stricter validation, new required field): bump the major version in `contract/package.json` and add a **BREAKING:** CHANGELOG entry with what clients must do. New optional field or endpoint: minor.
9. **Tests**: e2e in `test/e2e/` for the main path and main errors (401, 403, 404, 400, 409). Use `createTestApp` and `TestIssuer` tokens.
10. Update the module README endpoint table and CHANGELOG. Finish with `self-review`.
