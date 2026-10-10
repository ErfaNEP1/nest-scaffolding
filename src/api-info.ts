import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenApiInfo } from './core/http';

/**
 * OpenAPI title and version. The version is the contract package version
 * (contract/package.json): bump it (SemVer) when the API changes.
 */
export function apiInfo(): OpenApiInfo {
  const contract: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', 'contract', 'package.json'), 'utf8'),
  );
  const version: unknown =
    contract && typeof contract === 'object' ? Reflect.get(contract, 'version') : undefined;
  return {
    title: '{{PROJECT_NAME}} API',
    version: typeof version === 'string' ? version : '0.0.0',
  };
}
