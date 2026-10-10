# Runbook

## Start

| Environment                 | Command                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| Local, everything in Docker | `docker compose up --build` (add `--profile auth` for Keycloak)                |
| Local, app on the host      | `docker compose up -d postgres migrate`, then `pnpm dev` and `pnpm dev:worker` |
| Container                   | `docker run <image> api` or `docker run <image> worker`                        |

Order: PostgreSQL healthy → migrations (`db/migrate.sh`) → API and worker. The app never
runs migrations itself. Both processes exit at startup with a list of problems if the
configuration is invalid.

Check: `curl localhost:3000/health/ready` (API), `curl localhost:3001/health/ready` (worker),
`curl localhost:9464/metrics`.

## Stop

Send SIGTERM (`docker compose stop`, Kubernetes pod termination). The process:

1. reports `/health/ready` = 503,
2. stops accepting HTTP connections and finishes in-flight requests,
3. stops pg-boss (active jobs may finish), closes the database pool, flushes telemetry,
4. logs `shutdown complete` and exits 0.

If this takes longer than `SHUTDOWN_TIMEOUT_MS` (15 s), it logs `shutdown timed out` and exits 1.
Give the orchestrator a grace period a few seconds above `SHUTDOWN_TIMEOUT_MS`.

## Migrate

```bash
pnpm db:status                     # what is applied and pending (Docker Compose database)
pnpm db:migrate                    # apply
docker compose run --rm migrate --dry-run
MIGRATION_DATABASE_URL=postgres://... db/migrate.sh        # any database, with psql installed
```

In deployments run the image `postgres:<version>` with `db/` mounted and
`bash /db/migrate.sh`, before rolling out the new app version. Migrations must be
compatible with the previous app version during the rollout.

## Common failures

| Symptom                                                  | Likely cause                                                                       | What to do                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Exit at startup with `Invalid environment configuration` | Missing or invalid variable                                                        | The message lists them; see `docs/operations/configuration.md`.                                                                         |
| `/health/ready` 503, `database` down                     | PostgreSQL unreachable, pool exhausted, wrong `DATABASE_URL`                       | Check the database and `db_client_connection_*` metrics. The app recovers automatically when it is back.                                |
| `/health/ready` 503, `jobs` down                         | pg-boss failed to start (schema missing with `JOBS_AUTO_MIGRATE=false`, no rights) | Check logs (`context: Jobs`). Apply the pg-boss schema migration (`pnpm jobs:schema-sql`).                                              |
| `migrate: ERROR: ... was changed after it was applied`   | An applied migration file was edited                                               | Restore the file from git; put the change in a new migration.                                                                           |
| `migrate: ERROR: stopped` with a SQL error               | A migration failed; it was rolled back                                             | Fix the migration (it was not applied, so it may be edited) and rerun.                                                                  |
| All protected endpoints answer 503 `AUTH_UNAVAILABLE`    | JWKS or OIDC discovery unreachable                                                 | Check `OIDC_ISSUER_URL` / `OIDC_JWKS_URL` and the network to the identity provider.                                                     |
| 401 `INVALID_TOKEN` for valid-looking tokens             | Issuer or audience mismatch, wrong algorithm                                       | Compare token `iss`/`aud` with `OIDC_ISSUER_URL` / `OIDC_AUDIENCE`. In Docker Compose the issuer is `http://localhost:8080/realms/dev`. |
| 409 `CONCURRENT_UPDATE` spikes                           | Serialization failures or deadlocks                                                | Look for long transactions and inconsistent lock order. Clients may retry.                                                              |
| 503 `QUERY_TIMEOUT`                                      | Query exceeded `DB_STATEMENT_TIMEOUT_MS`                                           | Find the slow query (`slow db query` warnings, `db_client_operation_duration`).                                                         |
| `jobs_queue_depth{state="ready"}` grows                  | Worker down or too slow                                                            | Check worker health and logs; scale workers or raise `JOBS_CONCURRENCY`.                                                                |
| `jobs_processed_total{outcome="failed"}` grows           | Handler errors                                                                     | Logs with `queue` and `jobId`, `msg: "job failed"`. Failed jobs stay in `pgboss.job` for inspection.                                    |
| Process killed after `shutdown timed out`                | Long requests or jobs                                                              | Raise `SHUTDOWN_TIMEOUT_MS` (and the orchestrator grace period), or make jobs honour `job.signal`.                                      |
