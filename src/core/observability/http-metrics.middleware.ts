import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { routeTemplate } from '../logging/logger.module';
import { createCounter, createHistogram, DURATION_BUCKETS_SECONDS } from './metrics';

type HttpLabels = { method: string; route: string; status_class: string };

const requests = createCounter<HttpLabels>('http.server.requests', {
  description: 'HTTP requests handled, by method, route template and status class.',
  labels: ['method', 'route', 'status_class'],
});
const duration = createHistogram<HttpLabels>('http.server.request.duration', {
  description: 'HTTP request duration, by method, route template and status class.',
  unit: 's',
  advice: { explicitBucketBoundaries: DURATION_BUCKETS_SECONDS },
  labels: ['method', 'route', 'status_class'],
});

/** Records request count and duration when the response finishes. */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.once('finish', () => {
      const labels: HttpLabels = {
        method: req.method,
        route: routeTemplate(req),
        status_class: `${Math.floor(res.statusCode / 100)}xx`,
      };
      requests.add(1, labels);
      duration.record(Number(process.hrtime.bigint() - start) / 1e9, labels);
    });
    next();
  }
}
