# Observability

## Health endpoints

No authentication, not access-logged, outside `/api`.

| Process                           | Endpoint                                | Meaning                                                                                                                                  |
| --------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| API (`HTTP_PORT`, 3000)           | `GET /health/live`                      | Process is up. No dependency checks. Use for liveness probes.                                                                            |
| API                               | `GET /health/ready`                     | 200 when the database answers (2 s timeout), pg-boss is started and no shutdown is in progress; otherwise 503. Use for readiness probes. |
| Worker (`WORKER_HTTP_PORT`, 3001) | `GET /health/live`, `GET /health/ready` | Same checks. The worker serves nothing else on this port.                                                                                |

The body is the `@nestjs/terminus` result, for example
`{"status":"error","details":{"database":{"status":"down",...},"jobs":{"status":"up"},"shutdown":{"status":"up"}}}`.

## Metrics

Prometheus format at `GET /metrics` on `METRICS_PORT` (API, 9464) and
`WORKER_METRICS_PORT` (worker, 9465). Never on the public API port. Set `METRICS_ENABLED=false`
to turn the endpoint off. With `OTEL_EXPORTER_OTLP_ENDPOINT` set, the same metrics are also
pushed over OTLP every `OTEL_METRIC_EXPORT_INTERVAL` ms.

| Metric (Prometheus name)                                                                                                  | Type                                                 | Labels                                                  | Source                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `http_server_requests_total`                                                                                              | counter                                              | `method`, `route` (template), `status_class` (`2xx`...) | `HttpMetricsMiddleware`                       |
| `http_server_request_duration` (`_bucket`, `_sum`, `_count`), seconds                                                     | histogram                                            | same                                                    | `HttpMetricsMiddleware`                       |
| `nodejs_eventloop_delay_*` (min, max, mean, p50, p90, p99), `nodejs_eventloop_utilization`, `nodejs_eventloop_time_total` | gauge/counter                                        |                                                         | runtime instrumentation                       |
| `v8js_memory_heap_*`, `v8js_gc_duration`, `v8js_resource_active`                                                          | gauge/histogram                                      | heap space, GC type                                     | runtime instrumentation                       |
| `process_cpu_time_total`, seconds                                                                                         | counter                                              | `cpu_mode` (`user`, `system`)                           | `telemetry.ts`                                |
| `db_client_connection_count`                                                                                              | gauge                                                | `db_client_connection_state` (`idle`, `used`)           | pg instrumentation (pool)                     |
| `db_client_connection_pending_requests`                                                                                   | gauge                                                |                                                         | pg instrumentation (waiting for a connection) |
| `db_client_connection_max`                                                                                                | gauge                                                |                                                         | pg instrumentation (pool size)                |
| `db_client_operation_duration`, seconds                                                                                   | histogram                                            | `db_operation_name`, ...                                | pg instrumentation                            |
| `jobs_processed_total`                                                                                                    | counter                                              | `queue`, `outcome` (`completed`, `failed`)              | worker                                        |
| `jobs_retried_total`                                                                                                      | counter                                              | `queue`                                                 | worker (attempts with retry count > 0)        |
| `jobs_duration`, seconds                                                                                                  | histogram                                            | `queue`, `outcome`                                      | worker                                        |
| `jobs_queue_depth`                                                                                                        | gauge, sampled every `JOBS_QUEUE_DEPTH_INTERVAL_SEC` | `queue`, `state` (`ready`, `active`, `deferred`)        | worker                                        |
| `build_info` (value 1)                                                                                                    | gauge                                                | `service`, `version`, `commit`                          | `telemetry.ts`                                |
| `app_sample_created_total`                                                                                                | counter                                              |                                                         | sample module (remove with it)                |

Every series also has `otel_scope_name`; `target_info` carries the resource attributes
(`service_name`, `service_version`, `deployment_environment_name`, `service_role`).

### Rules for new metrics

- Create them with the helpers in `src/core/observability/metrics.ts`.
- Names: dotted snake_case, prefix `app.<module>.` (`app.orders.placed`).
- **No high-cardinality labels**: no user ids, request ids, entity ids, emails or raw URLs.
  Use route templates, status classes, queue names, small enums.
- Add every new metric to the table above.

## Logs

JSON lines on stdout (pretty in local development with `LOG_PRETTY=true`). Level from
`LOG_LEVEL` (default `info`).

| Field                             | Present            | Meaning                                            |
| --------------------------------- | ------------------ | -------------------------------------------------- |
| `level`                           | always             | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `time`                            | always             | ISO-8601 UTC                                       |
| `msg`                             | always             | Short, stable message                              |
| `service`, `env`, `version`       | always             | `APP_NAME`, `NODE_ENV`, `APP_VERSION`              |
| `context`                         | most               | Logger name (class)                                |
| `requestId`                       | HTTP               | Same value as the `x-request-id` response header   |
| `traceId`, `spanId`, `traceFlags` | inside a span      | OpenTelemetry ids, also without an exporter        |
| `userId`                          | authenticated HTTP | Token `sub`                                        |
| `jobId`, `queue`                  | jobs               | pg-boss job id and queue                           |
| `err`                             | errors             | `type`, `message`, `stack`                         |

Access log: one line per request, `msg: "request completed"` with `method`, `route`
(template, `<unmatched>` for unknown routes), `statusCode`, `durationMs`. With
`LOG_LEVEL=debug` it also contains `requestHeaders` (with `authorization` and `cookie`
redacted). Health probes are not access-logged.

Error logging: 5xx at `error` with the stack (`msg: "request failed"`), 4xx at `warn`
(`"request rejected"`), validation errors at `info` (`"request validation failed"`). Jobs:
`job started`, `job completed`, `job failed` (with `err` and `retryCount`).

Redaction: fields named `authorization`, `cookie`, `set-cookie`, or containing `password`,
`secret`, `token`, `apiKey`/`api_key`, `private_key`, `credential` are replaced with
`[REDACTED]` at any depth.

## Tracing

- `src/instrumentation.ts` starts OpenTelemetry before the app (`node --import ./dist/instrumentation.js`).
- Instrumentations: http, express, nestjs-core, pg, pino (log correlation only) and pg-boss's
  own (a span per job, continuing the trace of the request that enqueued it).
- Sampler: parent-based, trace id ratio `OTEL_TRACES_SAMPLER_ARG` (default 1).
- Export: only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (OTLP/HTTP, `/v1/traces`). Without
  it spans are still created for log correlation and `traceparent` propagation, and nothing
  is exported (no exporter errors).
- Service name: `OTEL_SERVICE_NAME` (default `APP_NAME`).
- Incoming and outgoing HTTP calls propagate W3C `traceparent`.
- Custom spans: `withSpan(name, attributes, fn)` from `src/core/observability/tracing.ts`.
