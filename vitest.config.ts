import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC keeps decorator metadata, which Nest dependency injection needs.
const plugins = [swc.vite({ module: { type: 'es6' } })];

export default defineConfig({
  plugins,
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/worker.ts', 'src/instrumentation.ts'],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 },
    },
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        plugins,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.int-spec.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
      {
        plugins,
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.e2e-spec.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
