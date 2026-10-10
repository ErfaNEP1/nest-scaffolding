---
name: observability
description: Use when adding or changing logs, metrics or tracing spans, or when debugging with them. Covers log levels and fields, redaction, metric naming and labels, custom spans and updating docs/operations/observability.md.
---

# Observability

Reference: `docs/operations/observability.md`. Code: `src/core/logging`, `src/core/observability`.

## Logs (pino)

- Inject: `@InjectPinoLogger(MyService.name) private readonly logger: PinoLogger`. Never `console.*`.
- Short message + fields: `this.logger.info({ orderId, total }, 'order placed')`. Messages are stable, lower case, no interpolated values.
- Levels: `error` needs attention (failed job, 5xx); `warn` unexpected but handled; `info` business-relevant events; `debug` diagnostics.
- Automatic fields: `service`, `env`, `version`, `requestId`, `traceId`, `spanId`, `userId` (HTTP), `jobId`, `queue` (jobs). Do not add them by hand.
- Never log secrets, tokens, passwords or full personal data (no full names, emails, addresses). Keys named like `password`, `secret`, `token`, `apiKey`, `authorization`, `cookie` are redacted at any depth, but do not rely on it: do not log them.
- Do not log and rethrow the same error; the global filter or job runner logs it once.

## Metrics (OpenTelemetry → Prometheus)

- Use the helpers: `createCounter`, `createHistogram`, `createUpDownCounter`, `createObservableGauge` from `src/core/observability`. Define instruments once at module level (see `sample.metrics.ts`).
- Names: dotted snake_case with the module as prefix: `app.<module>.<thing>` (Prometheus: `app_<module>_<thing>_total`).
- Durations: unit `s`, buckets `DURATION_BUCKETS_SECONDS`.
- Labels: few values only (queue, outcome, status class, route template). **Never** ids, user ids, request ids, emails or raw URLs; the helper rejects common ones (`labels: [...]`).

## Traces

- HTTP, Express, Nest, pg, pino and each job already get spans. Add a custom span only around meaningful work (an external call, a batch step): `await withSpan('invoice.render', { 'invoice.lines': n }, () => render())`.
- Span attributes may hold ids; never personal data or secrets.

## Docs

Every new metric or log field goes into `docs/operations/observability.md` in the same change.
