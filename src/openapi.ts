/**
 * Writes openapi/openapi.json from the controllers, without a database connection.
 *   pnpm openapi:generate          write the file
 *   pnpm openapi:check             fail if the committed file is out of date
 */
import 'reflect-metadata';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiInfo } from './api-info';
import { AppModule } from './app.module';
import { ConfigService, loadToolingConfig } from './config';
import { buildOpenApiDocument, configureHttp } from './core/http';

const OUTPUT = join(__dirname, '..', 'openapi', 'openapi.json');

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(loadToolingConfig(), { connectDatabase: false }),
    { logger: false, bodyParser: false },
  );
  configureHttp(app, app.get(ConfigService));
  const json = `${JSON.stringify(buildOpenApiDocument(app, apiInfo()), null, 2)}\n`;
  await app.close();

  if (!check) {
    writeFileSync(OUTPUT, json);
    process.stdout.write(`openapi: wrote ${OUTPUT}\n`);
    return;
  }
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    // Missing file: reported below.
  }
  if (current !== json) {
    process.stderr.write(
      'openapi: openapi/openapi.json is out of date. Run `pnpm openapi:generate` and commit it.\n',
    );
    process.exit(1);
  }
  process.stdout.write('openapi: openapi/openapi.json is up to date\n');
}

void main();
