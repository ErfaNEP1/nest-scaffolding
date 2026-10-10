import {
  type Attributes,
  type Counter,
  type Histogram,
  type MetricOptions,
  metrics,
  type ObservableGauge,
  type UpDownCounter,
} from '@opentelemetry/api';

/** Meter name for all application metrics. */
export const METER_NAME = 'app';

/**
 * Metric names are lower case, dot-separated words with underscores, for example
 * `app.sample.items_created`. Prometheus shows it as `app_sample_items_created_total`.
 */
const METRIC_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/**
 * Labels (attributes) that must never be used: they have unbounded values and would create
 * one time series per value. Use route templates, status classes, queue names instead.
 */
const FORBIDDEN_LABELS = new Set([
  'id',
  'user_id',
  'userId',
  'request_id',
  'requestId',
  'trace_id',
  'traceId',
  'url',
  'path',
  'email',
]);

/** Duration buckets in seconds, for latency histograms. */
export const DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
];

function checkName(name: string): void {
  if (!METRIC_NAME.test(name)) {
    throw new Error(
      `Invalid metric name "${name}": use dotted snake_case like "app.orders.created".`,
    );
  }
}

/** Throws if attributes contain a high-cardinality label. Used by the helpers below. */
export function checkLabels(labels: readonly string[]): void {
  const bad = labels.filter((label) => FORBIDDEN_LABELS.has(label));
  if (bad.length > 0) {
    throw new Error(`High-cardinality metric labels are not allowed: ${bad.join(', ')}`);
  }
}

interface Options extends MetricOptions {
  /** Every label this metric may carry. Checked once, at creation. */
  labels?: readonly string[];
}

function prepare(name: string, options: Options): MetricOptions {
  checkName(name);
  checkLabels(options.labels ?? []);
  const { labels: _labels, ...rest } = options;
  return rest;
}

const meter = () => metrics.getMeter(METER_NAME);

/** Monotonic counter (Prometheus `_total`). */
export function createCounter<T extends Attributes>(name: string, options: Options): Counter<T> {
  return meter().createCounter<T>(name, prepare(name, options));
}

export function createUpDownCounter<T extends Attributes>(
  name: string,
  options: Options,
): UpDownCounter<T> {
  return meter().createUpDownCounter<T>(name, prepare(name, options));
}

/** Histogram. For durations use unit `s` and {@link DURATION_BUCKETS_SECONDS}. */
export function createHistogram<T extends Attributes>(
  name: string,
  options: Options,
): Histogram<T> {
  return meter().createHistogram<T>(name, prepare(name, options));
}

/** Gauge sampled on every collection (scrape or export). */
export function createObservableGauge<T extends Attributes>(
  name: string,
  options: Options,
): ObservableGauge<T> {
  return meter().createObservableGauge<T>(name, prepare(name, options));
}
