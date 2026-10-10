---
name: data-access
description: Use when writing or changing repository code, queries or transactions with TypeORM. Covers transaction-aware access, @Transactional, the DbSessionContext hook, optimistic locking, avoiding N+1, raw SQL rules and PostgreSQL error mapping.
---

# Data access

Rules: `docs/database/conventions.md`. Example: `src/modules/sample/sample.repository.ts`.

## Repository shape

```ts
@Injectable()
export class OrderRepository {
  constructor(private readonly txHost: TransactionHost<DbAdapter>) {}
  private get manager() { return this.txHost.tx; } // current transaction or default manager
  findById(id: string) { return this.manager.findOneBy(OrderEntity, { id }); }
}
```

- Always use `txHost.tx`. Never inject `DataSource` or `Repository<T>` directly in modules: those bypass the transaction.
- Repositories hold queries only. Business rules and authorization belong to services.
- Register entities explicitly: `TypeOrmModule.forFeature([OrderEntity])` in the module.

## Transactions

- Mark service methods that write more than once (or write + enqueue) with `@Transactional()`.
- Nested `@Transactional()` calls reuse the outer transaction (savepoints when needed).
- Every transaction first runs `DbSessionContext.apply()` (default: no-op). Projects plug in RLS settings there; see `src/core/database/db-session-context.ts`.

## Optimistic locking

- Shared, user-edited rows have `row_version integer NOT NULL DEFAULT 1`.
- Update with `updateWithVersion(manager, Entity, id, expectedVersion, changes, () => new XNotFoundError())`: 404 if missing, 409 `VERSION_CONFLICT` if stale.
- Background updates that must not conflict use a conditional `UPDATE ... WHERE status = ...` and increment `row_version` too (see `markProcessed`).

## Queries

- Parameterized only (`:name` parameters in QueryBuilder, `$1` in `manager.query`). Never concatenate input into SQL.
- No lazy relations, no `eager: true`. Load what you need with explicit joins or a second query by ids (`In(ids)`), never a query per row (N+1).
- Lists: keyset pagination on an indexed, stable order; fetch `limit + 1` rows.
- Raw SQL is fine for reports and bulk updates; keep it in the repository and comment why.
- `bigint`/`numeric` come back as strings; convert explicitly.

## Errors

- Unique/foreign key/check violations and serialization failures are mapped centrally (`mapPostgresError`) to 409/422 Problem Details.
- For a specific message (`EMAIL_TAKEN`), catch in the service and check `pgErrorCode(error) === PG_ERROR.UNIQUE_VIOLATION`.

## Test

Integration test per repository in `test/integration/<module>/` (real PostgreSQL via Testcontainers, `truncateAll` in `beforeEach`).
