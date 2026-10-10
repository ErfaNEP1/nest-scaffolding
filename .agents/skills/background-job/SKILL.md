---
name: background-job
description: Use when adding or changing a background job (work that runs outside the request in the worker process with pg-boss). Covers the payload schema, idempotency, retries and backoff, enqueueing from a service, the handler in the worker, logs, metrics and tests.
---

# Background job

Guide: `docs/guides/adding-a-job.md`. Example: `src/modules/sample/sample.jobs.ts` and `sample.job-handler.ts`.

## Steps

1. **Define** in `<module>.jobs.ts`:

   ```ts
   export const sendInvoiceJob = defineJob({
     queue: 'invoice.send',                      // <module>.<action>
     payload: z.object({ invoiceId: z.uuid() }), // ids only, no secrets, no whole objects
     options: { retryLimit: 5, retryDelaySec: 30, retryBackoff: true, expireSec: 300 },
   });
   ```

2. **Enqueue** from the service, inside the same `@Transactional()` as the data change, so the job exists only if the data was committed:
   `await this.jobs.enqueue(sendInvoiceJob, { invoiceId })`. Options: `startAfter`, `singletonKey`, `priority`.
3. **Handle** in `<module>.job-handler.ts`, a provider of the module:

   ```ts
   @JobHandler(sendInvoiceJob, { concurrency: 2 })
   async send(payload: JobPayload<typeof sendInvoiceJob>, job: JobInfo) { ... }
   ```

   Keep the handler thin: call a service method.
4. **Idempotent**: a job can run more than once (retries, expiry, crashes). Check state first (`WHERE status = 'new'`), use unique keys for side effects, never assume first run.
5. **Retries**: throw to retry. Set explicit `retryLimit`/backoff. Errors that retrying cannot fix: log at `error` and complete without throwing, or let them exhaust retries (failed jobs stay visible).
6. **Long work**: respect `job.signal` (aborted on expiry/shutdown); keep `expireSec` above the normal duration.
7. **Observability**: job context (`jobId`, `queue`), span and metrics (`jobs_processed_total`, `jobs_retried_total`, `jobs_duration`, `jobs_queue_depth`) are automatic. Log business outcomes at `info`.

## Tests

- Unit test the service method the handler calls.
- Integration/e2e: start the worker with `createTestWorker()`, enqueue, then `waitFor(...)` the outcome (no sleeps). Force a failure once to test retries (see `test/integration/jobs/jobs.int-spec.ts`).

## Docs

Module README "Jobs" table, CHANGELOG. New config → `docs/operations/configuration.md`.
