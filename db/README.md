# Database migrations

The database schema is owned by plain SQL files in `db/migrations/`, applied by
`db/migrate.sh` with `psql`. TypeORM never changes the schema (`synchronize: false`, no
TypeORM migrations). Conventions: `docs/database/conventions.md`.

## Commands

| Command                                     | What it does                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm db:new <name>`                        | Create the next file, for example `db/migrations/0003_add_order_note.sql`. |
| `pnpm db:migrate`                           | Apply pending migrations to the Docker Compose database.                   |
| `pnpm db:status`                            | Show applied and pending migrations.                                       |
| `docker compose run --rm migrate --dry-run` | List pending migrations without applying them.                             |

`pnpm db:migrate` and `pnpm db:status` run the script inside the `migrate` service
(the official `postgres` image), so you only need Docker. With `psql` installed you can
also run it directly: `MIGRATION_DATABASE_URL=postgres://... db/migrate.sh`.

## How `migrate.sh` works

- Connection: `MIGRATION_DATABASE_URL`, falling back to `DATABASE_URL`. Use a role with
  DDL rights; the application role can be read/write only.
- Files are named `NNNN_short_name.sql` (four digits, lower case) and run in order.
- Applied files are recorded in `public.schema_migrations` (`version`, `name`, `checksum`,
  `applied_at`) with a SHA-256 checksum. An applied file is never run again. If its
  content changed, the script stops with an error before applying anything.
- Each file runs in its own transaction with `ON_ERROR_STOP`. A failing file is rolled
  back and nothing after it runs.
- A file that cannot run inside a transaction (for example `CREATE INDEX CONCURRENTLY`)
  starts with `-- migrate:no-transaction` in its first five lines. Keep such a file to that
  one statement.
- A PostgreSQL advisory lock stops two runs from overlapping.
- Forward-only: there are no down migrations. To undo a change, write a new migration.
- Exit codes: `0` success, `1` migration or database error, `2` usage or setup error.

## Rules

- Never edit or rename a file that may have been applied anywhere.
- One logical change per file, with the matching entity change in the same commit.
- Do not put `BEGIN` / `COMMIT` in a file; the script wraps it.
- Data-changing migrations (backfills, deletes) need a review; see
  `.agents/skills/database-migration/SKILL.md` for safe patterns.
