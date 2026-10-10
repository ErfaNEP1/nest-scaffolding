import { RequestMethod, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { ConfigService } from '../../config';

export const API_PREFIX = 'api';

/** Routes outside `/api` (probes). They are not versioned and need no auth. */
export const UNPREFIXED_ROUTES = [{ path: 'health/{*path}', method: RequestMethod.GET }];

/**
 * HTTP settings shared by the real app and the e2e app factory:
 * `/api` prefix, URI versioning (`/api/v1/...`), helmet, and CORS allow-list. JSON body
 * parsing (with the size limit) is middleware in `HttpModule`.
 */
export function configureHttp(app: NestExpressApplication, config: ConfigService): void {
  const http = config.get('http');
  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(helmet());
  app.enableCors({
    origin: http.corsOrigins,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.set('trust proxy', http.trustProxy);
  app.disable('x-powered-by');
}
