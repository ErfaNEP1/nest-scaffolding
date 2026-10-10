import type { DynamicModule } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClsModule, type ClsPlugin } from 'nestjs-cls';
import { REQUEST_ID_HEADER, requestIdFor } from './request-id';

/**
 * Request/job context backed by AsyncLocalStorage (nestjs-cls). For HTTP, the middleware
 * opens a context per request, resolves the request id and echoes it in `x-request-id`.
 */
export function contextModule(plugins: ClsPlugin[] = []): DynamicModule {
  return ClsModule.forRoot({
    global: true,
    plugins,
    middleware: {
      // Mounted by HttpModule for every route (Nest would scope it to the /api prefix).
      mount: false,
      generateId: true,
      idGenerator: (req: Request) => requestIdFor(req),
      setup: (cls, _req: Request, res: Response) => {
        const requestId = cls.getId();
        cls.set('requestId', requestId);
        res.setHeader(REQUEST_ID_HEADER, requestId);
      },
    },
  });
}
