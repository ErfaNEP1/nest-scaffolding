import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ProblemDetails } from './api-contract';

export const DOCS_PATH = '/api/docs';

export interface OpenApiInfo {
  title: string;
  version: string;
}

/**
 * Builds the OpenAPI document from the controllers and their Zod DTOs.
 * The same function feeds `pnpm openapi:generate` and the docs UI.
 */
export function buildOpenApiDocument(app: INestApplication, info: OpenApiInfo): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(info.title)
    .setVersion(info.version)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addSecurityRequirements('bearer')
    .build();
  return cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, config, {
      extraModels: [ProblemDetails],
      operationIdFactory: (controller, method) =>
        `${controller.replace(/Controller$/, '')}_${method}`,
    }),
  );
}

/** Serves the API reference UI at /api/docs and the document at /api/docs/openapi.json. */
export function serveApiDocs(app: INestApplication, document: OpenAPIObject): void {
  const http = app.getHttpAdapter();
  http.get(`${DOCS_PATH}/openapi.json`, (_req: unknown, res: { json(body: unknown): void }) => {
    res.json(document);
  });
  app.use(DOCS_PATH, apiReference({ url: `${DOCS_PATH}/openapi.json`, pageTitle: info(document) }));
}

function info(document: OpenAPIObject): string {
  return `${document.info.title} ${document.info.version}`;
}
