import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { ValueType } from '@opentelemetry/api';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Job } from 'pg-boss';
import { ConfigService } from '../../config';
import { runInContext } from '../context/context';
import { createObservableGauge } from '../observability/metrics';
import { JOB_HANDLER, type JobHandlerMetadata, type JobInfo } from './job-handler.decorator';
import { jobDuration, jobsProcessed, jobsRetried } from './jobs.metrics';
import { JobsService } from './jobs.service';

type Handler = (payload: unknown, info: JobInfo) => Promise<unknown>;

interface QueueDepth {
  queue: string;
  ready: number;
  active: number;
  deferred: number;
}

/**
 * Worker side of the job system (registered only in WorkerModule): finds `@JobHandler`
 * methods, subscribes them to their queues, wraps each job in a job context, validates the
 * payload, records metrics and samples queue depth.
 */
@Injectable()
export class JobWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private depths: QueueDepth[] = [];
  private depthTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
    @InjectPinoLogger('JobWorker') private readonly logger: PinoLogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.jobs.isStarted()) return;
    const handlers = this.findHandlers();
    for (const { metadata, handler } of handlers) {
      await this.subscribe(metadata, handler);
    }
    this.startDepthSampling(handlers.map(({ metadata }) => metadata.definition.queue));
    this.logger.info(
      { queues: handlers.map(({ metadata }) => metadata.definition.queue) },
      'worker subscribed',
    );
  }

  onApplicationShutdown(): void {
    clearInterval(this.depthTimer);
  }

  private findHandlers(): { metadata: JobHandlerMetadata; handler: Handler }[] {
    const found: { metadata: JobHandlerMetadata; handler: Handler }[] = [];
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;
      const prototype: unknown = Object.getPrototypeOf(instance);
      if (!prototype || typeof prototype !== 'object') continue;
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const method: unknown = Reflect.get(instance, name);
        if (typeof method !== 'function') continue;
        const metadata = Reflect.getMetadata(JOB_HANDLER, method) as JobHandlerMetadata | undefined;
        if (!metadata) continue;
        const handler: Handler = (payload, info) =>
          Promise.resolve(method.call(instance, payload, info));
        found.push({ metadata, handler });
      }
    }
    const queues = found.map(({ metadata }) => metadata.definition.queue);
    const duplicate = queues.find((queue, index) => queues.indexOf(queue) !== index);
    if (duplicate) throw new Error(`More than one @JobHandler for queue "${duplicate}".`);
    return found;
  }

  private async subscribe(metadata: JobHandlerMetadata, handler: Handler): Promise<void> {
    const { definition } = metadata;
    const concurrency = metadata.options.concurrency ?? this.config.get('jobs').concurrency;
    await this.jobs
      .instance()
      .work(
        definition.queue,
        { batchSize: 1, localConcurrency: concurrency, pollingIntervalSeconds: 1 },
        async ([job]: Job[]) => {
          if (job) await this.run(metadata, handler, job);
        },
      );
  }

  private run(metadata: JobHandlerMetadata, handler: Handler, job: Job): Promise<void> {
    const queue = metadata.definition.queue;
    return runInContext({ jobId: job.id, queue }, async () => {
      const start = process.hrtime.bigint();
      const seconds = () => Number(process.hrtime.bigint() - start) / 1e9;
      if (job.retryCount > 0) jobsRetried.add(1, { queue });
      this.logger.info({ retryCount: job.retryCount }, 'job started');
      try {
        const parsed = metadata.definition.payload.safeParse(job.data);
        if (!parsed.success) {
          // Retrying cannot fix a bad payload, but failing keeps the job visible for inspection.
          throw new Error(
            `Invalid payload: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
          );
        }
        await handler(parsed.data, {
          id: job.id,
          queue,
          retryCount: job.retryCount,
          signal: job.signal,
        });
        jobsProcessed.add(1, { queue, outcome: 'completed' });
        jobDuration.record(seconds(), { queue, outcome: 'completed' });
        this.logger.info({ durationMs: Math.round(seconds() * 1000) }, 'job completed');
      } catch (error) {
        jobsProcessed.add(1, { queue, outcome: 'failed' });
        jobDuration.record(seconds(), { queue, outcome: 'failed' });
        this.logger.error({ err: error, retryCount: job.retryCount }, 'job failed');
        throw error;
      }
    });
  }

  /** Samples queue sizes for the `jobs.queue.depth` gauge (pg-boss stats are cached). */
  private startDepthSampling(queues: string[]): void {
    if (queues.length === 0) return;
    const sample = async () => {
      try {
        const results = await this.jobs.instance().getQueues(queues);
        this.depths = results.map((q) => ({
          queue: q.name,
          ready: q.readyCount,
          active: q.activeCount,
          deferred: q.deferredCount,
        }));
      } catch (error) {
        this.logger.warn({ err: error }, 'queue depth sampling failed');
      }
    };
    void sample();
    this.depthTimer = setInterval(
      () => void sample(),
      this.config.get('jobs').queueDepthIntervalSec * 1000,
    );
    this.depthTimer.unref();
    createObservableGauge<{ queue: string; state: string }>('jobs.queue.depth', {
      description: 'Jobs waiting (ready, deferred) or running (active) per queue, sampled.',
      valueType: ValueType.INT,
      labels: ['queue', 'state'],
    }).addCallback((result) => {
      for (const depth of this.depths) {
        result.observe(depth.ready, { queue: depth.queue, state: 'ready' });
        result.observe(depth.active, { queue: depth.queue, state: 'active' });
        result.observe(depth.deferred, { queue: depth.queue, state: 'deferred' });
      }
    });
  }
}
