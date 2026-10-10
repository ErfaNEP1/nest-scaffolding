# Adding a background job

Checklist: `.agents/skills/background-job/SKILL.md`. Example: `src/modules/sample/sample.jobs.ts`.

```ts
// <module>.jobs.ts
export const sendInvoiceJob = defineJob({
  queue: 'invoice.send',
  payload: z.object({ invoiceId: z.uuid() }),
  options: { retryLimit: 5, retryDelaySec: 30, retryBackoff: true, expireSec: 300 },
});

// in a service, inside @Transactional()
await this.jobs.enqueue(sendInvoiceJob, { invoiceId: invoice.id });

// <module>.job-handler.ts (a provider of the module; runs only in the worker)
@JobHandler(sendInvoiceJob)
async send(payload: JobPayload<typeof sendInvoiceJob>, job: JobInfo) {
  await this.invoices.send(payload.invoiceId);
}
```

- Payloads carry ids, never whole objects or secrets. They are validated on enqueue and
  before the handler runs.
- Handlers must be idempotent: a job can run more than once.
- Throwing fails the attempt; pg-boss retries with the job's settings (defaults from
  `JOBS_*`). Respect `job.signal` in long work.
- Enqueueing inside a transaction writes the job in that transaction: no job without data,
  no data without job.
- Test with `createTestWorker()` and `waitFor()`; force one failure to test retries.

## When the app role cannot create the pg-boss schema

pg-boss creates and updates its schema (`JOBS_SCHEMA`, default `pgboss`) at startup. If the
application's database role has no DDL rights:

1. Set `JOBS_AUTO_MIGRATE=false` for the app.
2. Export the schema SQL into a migration:

   ```bash
   pnpm db:new pgboss_schema                              # prints e.g. db/migrations/0003_pgboss_schema.sql
   pnpm --silent jobs:schema-sql > db/migrations/0003_pgboss_schema.sql
   ```

   The file starts with `-- migrate:no-transaction` because the SQL manages its own transaction.

3. Grant the app role usage and DML rights on that schema.
4. After upgrading pg-boss, export the upgrade SQL from the installed schema version:
   `pnpm --silent jobs:schema-sql --from <installed version> > db/migrations/NNNN_pgboss_upgrade.sql`
   (installed version: `SELECT version FROM pgboss.version`).
