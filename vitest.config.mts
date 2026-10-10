import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC keeps decorator metadata, which Nest dependency injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } })],
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
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.int-spec.ts'],
          globalSetup: ['test/support/postgres.global-setup.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.e2e-spec.ts'],
          globalSetup: ['test/support/postgres.global-setup.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
