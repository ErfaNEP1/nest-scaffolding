---
name: database-migration
description: Use for any database schema change (new table, column, index, constraint, extension, or data backfill). Covers pnpm db:new, one change per file, never editing applied files, safe patterns for large tables, the matching entity change and the integration test.
---

# Database migration

Rules: `docs/database/conventions.md` and `db/README.md`. Example: `db/migrations/0002_sample.sql`.

## Steps

1. `pnpm db:new <short_name>` creates `db/migrations/NNNN_short_name.sql` with a header. Fill in the purpose.
2. Write plain SQL. One logical change per file. No `BEGIN`/`COMMIT` (the runner wraps each file).
3. Update the entity (`<module>.entity.ts`) in the same commit. Column names are snake_case; TypeORM maps camelCase.
4. Apply locally: `pnpm db:migrate` (or restart `docker compose up`). `pnpm db:status` shows state.
5. Add or update an integration test that exercises the new schema (`test/integration/<module>/`).

## Never

- Edit, rename or delete a file that may have been applied anywhere (the runner fails on checksum change).
- Use TypeORM `synchronize` or TypeORM migrations.
- Write down migrations. To undo, write a new forward migration.

## Safe patterns (large or busy tables)

- **New required column**: add it nullable (or with a constant default) → backfill in batches (separate migration or job) → `SET NOT NULL` in a later migration.
- **Index**: `CREATE INDEX CONCURRENTLY` in its own file starting with `-- migrate:no-transaction` (first 5 lines), one statement only.
- **Foreign key / check on big tables**: add `NOT VALID`, then `VALIDATE CONSTRAINT` in a later migration.
- **Rename**: add new column, write both, backfill, switch reads, drop old later. Never rename in place on a live table.
- **Avoid table rewrites**: no column type changes that rewrite the table; no volatile defaults.
- Keep `lock_timeout` short for DDL on busy tables: `SET lock_timeout = '5s';` at the top.

## Stop and ask

- The migration deletes or rewrites data, or drops a column/table.
- It needs an extension that is not installed.
