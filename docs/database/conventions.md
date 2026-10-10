# Database conventions

PostgreSQL. The schema is owned by SQL files in `db/migrations/`; TypeORM is used only for
queries. Runner details: `db/README.md`.

## Naming

- Tables: plural, snake_case (`order_items`). Columns: snake_case (`created_at`).
- TypeScript properties are camelCase; `SnakeNamingStrategy` maps them. Give the table name
  explicitly: `@Entity({ name: 'order_items' })`.
- Primary key `id uuid`. Foreign keys `<entity>_id`.
- Indexes: `<table>_<columns>_idx`; unique: `<table>_<columns>_key`; checks: let PostgreSQL
  name them or `<table>_<rule>_check`.
- Schema `public` for the app, `pgboss` for jobs.

## Column types

| Data          | Type                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| Ids           | `uuid` (UUIDv7 from the app, `newId()`; no database defaults)          |
| Timestamps    | `timestamptz`, always UTC (connections use `TimeZone=UTC`)             |
| Money         | `bigint` or `integer` minor units + `text` currency (`char(3)` check)  |
| Text          | `text` with `CHECK (char_length(...) <= n)` where a limit matters      |
| Enums         | `text` + `CHECK (x IN (...))` (easier to change than PostgreSQL enums) |
| Flexible data | `jsonb`, only for data the database does not query structurally        |

Every table has `created_at` and `updated_at` (`timestamptz NOT NULL`). Shared, user-edited
rows also have `row_version integer NOT NULL DEFAULT 1`.

## Migrations

- New file per change: `pnpm db:new <name>`. One logical change per file. Forward-only.
- Never edit an applied file (checksums are verified). Never use TypeORM `synchronize` or
  TypeORM migrations.
- Each migration ships with the matching entity change and an integration test.
- Large tables: add nullable → backfill → constrain; `CREATE INDEX CONCURRENTLY` in a
  `-- migrate:no-transaction` file; `NOT VALID` then `VALIDATE` for constraints; no table
  rewrites. See the `database-migration` skill.
- Migrations run before the app starts (`migrate` service, deploy step), with
  `MIGRATION_DATABASE_URL` (a role with DDL rights). The app role needs only DML rights
  (plus pg-boss schema rights, or `JOBS_AUTO_MIGRATE=false`).

## TypeORM rules

- Entities are registered per module with `TypeOrmModule.forFeature([...])` (no glob loading).
- Repositories use `TransactionHost<DbAdapter>` → `txHost.tx` (current transaction or default
  manager). Never inject the global `DataSource` in modules.
- No lazy or eager relations. Load related data explicitly (join or a second query by ids).
  No query per row (N+1).
- Parameterized queries only. Raw SQL is allowed in repositories when clearer; comment why.
- `bigint`/`numeric` are returned as strings; convert explicitly.

## Transactions

- `@Transactional()` on service methods that write more than once, or write and enqueue a job.
- Default isolation READ COMMITTED. Use `@Transactional({ isolationLevel: 'SERIALIZABLE' })`
  only with a retry on `CONCURRENT_UPDATE`.
- `DbSessionContext.apply(manager)` runs at the start of every transaction. Default: nothing.
  A project can provide its own (for row-level security) with
  `DatabaseModule.forRoot({ sessionContext: MySessionContext })`; use transaction-local
  `set_config(name, value, true)`.
- Keep transactions short: no HTTP calls or slow work inside them. Enqueue a job instead.

## Locking

- Optimistic: `updateWithVersion(manager, Entity, id, expectedVersion, changes)` → 404 or
  409 `VERSION_CONFLICT`. Clients send back the `rowVersion` they read.
- Pessimistic (`SELECT ... FOR UPDATE`) only for short critical sections inside a
  transaction, in a consistent order to avoid deadlocks.

## Errors

PostgreSQL errors are mapped once (`src/core/database/pg-errors.ts`): unique violation → 409
`UNIQUE_VIOLATION`, foreign key → 409 `REFERENCE_CONFLICT`, check/not-null → 422
`CONSTRAINT_VIOLATION`, serialization failure/deadlock → 409 `CONCURRENT_UPDATE` (retryable),
statement timeout → 503 `QUERY_TIMEOUT`. SQL never appears in responses.
