# Adding a migration

Rules: `docs/database/conventions.md`, `db/README.md`. Safe patterns:
`.agents/skills/database-migration/SKILL.md`.

```bash
pnpm db:new add_order_note          # -> db/migrations/0003_add_order_note.sql
# write the SQL (no BEGIN/COMMIT)
pnpm db:migrate                     # apply to the Docker Compose database
pnpm db:status
```

1. One logical change per file. Forward-only; never edit a file that may have been applied.
2. Change the entity in the same commit.
3. Add or update an integration test (`test/integration/`); the test database is migrated
   with the same script.
4. Statements that cannot run in a transaction (`CREATE INDEX CONCURRENTLY`): first line
   `-- migrate:no-transaction`, one statement per file.
5. Data-changing or destructive migrations: stop and ask for review first.
