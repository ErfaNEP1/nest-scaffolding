#!/usr/bin/env node
// Builds contract/dist from openapi/openapi.json: the JSON itself and TypeScript types
// generated with openapi-typescript.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'openapi', 'openapi.json');
const dist = join(root, 'contract', 'dist');

const document = JSON.parse(readFileSync(source, 'utf8'));
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const ast = await openapiTS(document);
const banner =
  '// Generated from openapi/openapi.json by scripts/contract-build.mjs. Do not edit.\n';
writeFileSync(join(dist, 'schema.d.ts'), banner + astToString(ast));
writeFileSync(join(dist, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
writeFileSync(
  join(dist, 'index.d.ts'),
  `${banner}export type { components, operations, paths } from './schema.js';\nexport declare const apiVersion: string;\n`,
);
writeFileSync(
  join(dist, 'index.js'),
  `${banner}export const apiVersion = ${JSON.stringify(document.info.version)};\n`,
);
process.stdout.write(`contract: built ${dist} (API version ${document.info.version})\n`);
