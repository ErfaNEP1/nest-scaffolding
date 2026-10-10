import { createServer, type Server } from 'node:http';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { HealthService } from './health.service';

export const PROBE_PORT = Symbol('PROBE_PORT');

/**
 * Minimal HTTP server for `/health/live` and `/health/ready` in processes without an API
 * (the worker). It serves nothing else.
 */
@Injectable()
export class ProbeServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private server: Server | undefined;

  constructor(
    private readonly health: HealthService,
    @Inject(PROBE_PORT) private readonly port: number,
    @InjectPinoLogger('ProbeServer') private readonly logger: PinoLogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.handle(req.method, req.url).then(({ status, body }) => {
        res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
      });
    });
    const server = this.server;
    await new Promise<void>((resolve) => {
      server.listen(this.port, resolve);
    });
    this.logger.info({ port: this.port }, 'probe server started');
  }

  private async handle(method?: string, url?: string): Promise<{ status: number; body: unknown }> {
    if (method !== 'GET') return { status: 405, body: { status: 'method not allowed' } };
    if (url === '/health/live') return this.health.live();
    if (url === '/health/ready') {
      return this.health.ready().catch(() => ({ status: 503, body: { status: 'error' } }));
    }
    return { status: 404, body: { status: 'not found' } };
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}
