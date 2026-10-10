import { RequestMethod, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { ConfigService } from '../../config';
import { DOCS_PATH } from './openapi';

export const API_PREFIX = 'api';

/** Routes outside `/api` (probes). They are not versioned and need no auth. */
export const UNPREFIXED_ROUTES = [
  { path: 'health/live', method: RequestMethod.GET },
  { path: 'health/ready', method: RequestMethod.GET },
];

/**
 * HTTP settings shared by the real app and the e2e app factory:
 * `/api` prefix, URI versioning (`/api/v1/...`), helmet, and CORS allow-list. JSON body
 * parsing (with the size limit) is middleware in `HttpModule`.
 */
export function configureHttp(app: NestExpressApplication, config: ConfigService): void {
  const http = config.get('http');
  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const strict = helmet();
  // The docs UI loads its script from a CDN and runs inline code; relax CSP only there.
  const docs = helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        'connect-src': ["'self'"],
        'upgrade-insecure-requests': null,
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    (req.path.startsWith(DOCS_PATH) ? docs : strict)(req, res, next);
  });
  app.enableCors({
    origin: http.corsOrigins,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.set('trust proxy', http.trustProxy);
  app.disable('x-powered-by');
}
