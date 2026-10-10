/**
 * OpenTelemetry bootstrap. Loaded before anything else with
 * `node --import ./dist/instrumentation.js dist/main.js` (or worker.js), so the
 * instrumentations can patch http, express, Nest, pg and pino when they load.
 */
import { loadConfig } from './config';
import { startTelemetry } from './core/observability/telemetry';

const role = /worker\.[jt]s$/.test(process.argv[1] ?? '') ? 'worker' : 'api';

try {
  startTelemetry(loadConfig(), role);
} catch {
  // Invalid configuration: the entrypoint reports it and exits. Start without telemetry.
}
