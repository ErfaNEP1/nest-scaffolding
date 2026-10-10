# sample module

A small, complete feature that shows every convention of this template once. Copy its
structure for new modules, then delete it (`docs/guides/removing-the-sample-module.md`).

## Purpose

Users create "samples" (a name and an optional description). A background job marks each
new sample as processed. Users see and change only their own samples; admins see all.

## Public API (`index.ts`)

| Export             | What it is                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| `SampleModule`     | Nest module (registered in `src/feature-modules.ts`).                    |
| `SampleService`    | Business operations: `create`, `get`, `list`, `update`, `markProcessed`. |
| `processSampleJob` | Job definition, if another module wants to enqueue processing.           |

Other modules import only from `index.ts`, never from the other files.

## Endpoints

All need a Bearer token with role `user` or `admin`.

| Method and path                    | Description                                                                     | Errors                                       |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| `POST /api/v1/samples`             | Create. Body `{ name, description? }`. Enqueues `sample.process`.               | 400, 401, 403                                |
| `GET /api/v1/samples?limit&cursor` | List, newest first, cursor pagination (`limit` 1–100, default 20).              | 400, 401, 403                                |
| `GET /api/v1/samples/:id`          | Get one. Samples of other users answer 404 (`SAMPLE_NOT_FOUND`).                | 400, 401, 403, 404                           |
| `PATCH /api/v1/samples/:id`        | Update `name` and/or `description`. Body must include the current `rowVersion`. | 400, 401, 403, 404, 409 (`VERSION_CONFLICT`) |

## Jobs

| Queue            | Enqueued by                               | Handled by                  | Payload        | Retries                                   |
| ---------------- | ----------------------------------------- | --------------------------- | -------------- | ----------------------------------------- |
| `sample.process` | `SampleService.create` (same transaction) | `SampleJobHandler` (worker) | `{ sampleId }` | 5, backoff from 10 s, expires after 300 s |

The handler is idempotent: it only changes a sample whose status is still `new`.

## Tables

`samples` (`db/migrations/0002_sample.sql`): `id`, `owner_id`, `name`, `description`,
`status` (`new`, `processed`), `row_version`, `created_at`, `updated_at`, `processed_at`.

## Metrics and logs

- `app_sample_created_total`: samples created.
- Logs: `sample created`, `sample updated`, `sample processed` with `sampleId`.

## Events and integrations

None.

## Configuration

None of its own. Uses the `JOBS_*` defaults for anything the job definition does not set.

## Files

| File                                       | Role                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `sample.controller.ts`                     | HTTP mapping only.                                                                       |
| `sample.service.ts`                        | Business rules and authorization.                                                        |
| `sample.repository.ts`                     | TypeORM queries (transaction-aware).                                                     |
| `sample.entity.ts`                         | Table mapping.                                                                           |
| `sample.dto.ts`                            | Zod schemas for requests and responses.                                                  |
| `sample.errors.ts`                         | Domain errors.                                                                           |
| `sample.jobs.ts` / `sample.job-handler.ts` | Job definition / worker handler.                                                         |
| `sample.metrics.ts`                        | Custom metric.                                                                           |
| `sample.service.spec.ts`                   | Unit tests. Integration: `test/integration/sample/`. E2E: `test/e2e/sample.e2e-spec.ts`. |
