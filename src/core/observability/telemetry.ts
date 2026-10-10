import { metrics, ValueType } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { type Instrumentation, registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationType,
  type IMetricReader,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { Config } from '../../config';
import { METER_NAME } from './metrics';

export type ProcessRole = 'api' | 'worker';

export interface Telemetry {
  /** Flushes and stops exporters. Called once during graceful shutdown. */
  shutdown(): Promise<void>;
}

const TELEMETRY_KEY = Symbol.for('app.telemetry');
type TelemetryGlobal = typeof globalThis & { [TELEMETRY_KEY]?: Telemetry };

/** Paths without traces: health probes. */
const UNTRACED = /^\/health(\/|$)/;

/**
 * Starts OpenTelemetry: tracing (exported only when OTLP is configured), metrics on a
 * Prometheus endpoint (and OTLP when configured) and the selected instrumentations.
 * Must run before Nest, Express, pg and pino are loaded (see src/instrumentation.ts).
 */
export function startTelemetry(config: Config, role: ProcessRole): Telemetry {
  const { app, telemetry } = config;
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: telemetry.serviceName,
    [ATTR_SERVICE_VERSION]: app.version,
    'deployment.environment.name': app.env,
    'service.role': role,
  });
  const otlp = telemetry.otlpEndpoint?.replace(/\/$/, '');

  const tracerProvider = new NodeTracerProvider({
    resource,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(telemetry.traceSampleRatio),
    }),
    // Without an endpoint spans are still created (trace ids in logs, traceparent
    // propagation) but nothing is exported, so no exporter errors appear.
    spanProcessors: otlp
      ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${otlp}/v1/traces` }))]
      : [],
  });
  tracerProvider.register();

  const readers: IMetricReader[] = [];
  if (telemetry.metricsEnabled) {
    readers.push(
      new PrometheusExporter({
        host: telemetry.metricsHost,
        port: role === 'worker' ? telemetry.workerMetricsPort : telemetry.metricsPort,
        endpoint: '/metrics',
      }),
    );
  }
  if (otlp) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${otlp}/v1/metrics` }),
        exportIntervalMillis: telemetry.metricExportIntervalMs,
      }),
    );
  }
  const meterProvider = new MeterProvider({
    resource,
    readers,
    views: [
      // HTTP server metrics come from our own middleware (route template and status class).
      {
        instrumentName: 'http.server.*',
        meterName: '@opentelemetry/instrumentation-http',
        aggregation: { type: AggregationType.DROP },
      },
      // Job metrics come from core/jobs (queue, outcome, retries, depth); pg-boss traces stay.
      { meterName: 'pg-boss', aggregation: { type: AggregationType.DROP } },
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  const instrumentations: Instrumentation[] = [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => UNTRACED.test(req.url ?? ''),
    }),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    new PgInstrumentation(),
    new PinoInstrumentation({
      disableLogSending: true,
      logKeys: { traceId: 'traceId', spanId: 'spanId', traceFlags: 'traceFlags' },
    }),
    new RuntimeNodeInstrumentation({ monitoringPrecision: 20 }),
  ];
  registerInstrumentations({ tracerProvider, meterProvider, instrumentations });

  registerProcessMetrics(config);

  const handle: Telemetry = {
    async shutdown() {
      await Promise.allSettled([tracerProvider.shutdown(), meterProvider.shutdown()]);
    },
  };
  (globalThis as TelemetryGlobal)[TELEMETRY_KEY] = handle;
  return handle;
}

/** The running telemetry, if src/instrumentation.ts started it. */
export function runningTelemetry(): Telemetry | undefined {
  return (globalThis as TelemetryGlobal)[TELEMETRY_KEY];
}

/** `build_info` and process CPU time. */
function registerProcessMetrics(config: Config): void {
  const meter = metrics.getMeter(METER_NAME);
  meter
    .createObservableGauge('build_info', {
      description: 'Build information; the value is always 1.',
      valueType: ValueType.INT,
    })
    .addCallback((result) => {
      result.observe(1, {
        service: config.app.name,
        version: config.app.version,
        commit: config.app.commit,
      });
    });
  meter
    .createObservableCounter('process.cpu.time', {
      description: 'CPU time used by the process.',
      unit: 's',
    })
    .addCallback((result) => {
      const usage = process.cpuUsage();
      result.observe(usage.user / 1e6, { 'cpu.mode': 'user' });
      result.observe(usage.system / 1e6, { 'cpu.mode': 'system' });
    });
}
