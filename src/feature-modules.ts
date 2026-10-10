import type { DynamicModule, Type } from '@nestjs/common';

/**
 * Feature modules (src/modules/<name>), loaded by both the API and the worker.
 * Add new modules here. In the worker, controllers are not served; only providers
 * (services, `@JobHandler` methods) are used.
 */
export const featureModules: (Type | DynamicModule)[] = [];
