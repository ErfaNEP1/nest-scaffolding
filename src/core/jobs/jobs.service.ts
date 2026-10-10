import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { type ConnectionOptions, PgBoss, type SendOptions } from 'pg-boss';
import { ConfigService } from '../../config';
import type { DbAdapter } from '../database/transactions';
import { ValidationError } from '../errors/domain-error';
import { type JobDefinition, type JobPayload, registeredJobs } from './job-definition';

export type ProcessRole = 'api' | 'worker';

export const JOBS_OPTIONS = Symbol('JOBS_OPTIONS');

export interface JobsModuleOptions {
  role: ProcessRole;
  /** `false` never connects pg-boss (OpenAPI generation, tooling). */
  start: boolean;
}

/** Per-call options for {@link JobsService.enqueue}. */
export interface EnqueueOptions {
  /** Run later: a Date or a number of seconds from now. */
  startAfter?: Date | number;
  /** Only one queued job per key (deduplication). */
  singletonKey?: string;
  priority?: number;
}

/**
 * pg-boss wrapper. Starts and stops with the application. In the API it only enqueues;
 * the worker process also runs handlers (see JobWorker).
 */
@Injectable()
export class JobsService implements OnModuleInit, OnApplicationShutdown {
  private boss: PgBoss | undefined;
  private started = false;

  constructor(
    private readonly config: ConfigService,
    private readonly txHost: TransactionHost<DbAdapter>,
    @InjectPinoLogger('Jobs') private readonly logger: PinoLogger,
    @Inject(JOBS_OPTIONS) private readonly options: JobsModuleOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.options.start) return;
    const jobs = this.config.get('jobs');
    const isWorker = this.options.role === 'worker';
    const boss = new PgBoss({
      connectionString: this.config.get('database').url,
      schema: jobs.schema,
      application_name: `${this.config.get('app').name}-jobs`,
      max: isWorker ? jobs.concurrency + 2 : 2,
      migrate: jobs.autoMigrate,
      createSchema: jobs.autoMigrate,
      // Maintenance and scheduling run in the worker only.
      supervise: isWorker,
      schedule: isWorker,
      // A span per job, with the trace context carried from send() to the handler.
      openTelemetry: { enabled: true, propagateContext: true },
    });
    boss.on('error', (error) => {
      this.logger.error({ err: error }, 'pg-boss error');
    });
    boss.on('warning', (warning) => {
      this.logger.warn({ warning }, 'pg-boss warning');
    });
    await boss.start();
    this.boss = boss;
    await this.createQueues();
    this.started = true;
    this.logger.info({ role: this.options.role, schema: jobs.schema }, 'jobs started');
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.boss) return;
    this.started = false;
    const timeout = Math.max(this.config.get('app').shutdownTimeoutMs - 2_000, 1_000);
    // Graceful: active jobs may finish (up to the timeout); then the pool closes.
    await this.boss.stop({ graceful: true, close: true, timeout });
    this.logger.info('jobs stopped');
  }

  isStarted(): boolean {
    return this.started;
  }

  /** The running pg-boss instance. Only for core/jobs internals and tests. */
  instance(): PgBoss {
    if (!this.boss) throw new Error('pg-boss is not started');
    return this.boss;
  }

  /**
   * Validates the payload and enqueues a job. Inside a `@Transactional()` method the job is
   * written in the same transaction, so it exists only if the transaction commits.
   * Returns the job id (null when a singleton job is already queued).
   */
  async enqueue<D extends JobDefinition>(
    job: D,
    payload: JobPayload<D>,
    options: EnqueueOptions = {},
  ): Promise<string | null> {
    const parsed = job.payload.safeParse(payload);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
        'INVALID_JOB_PAYLOAD',
        `Invalid payload for job ${job.queue}.`,
      );
    }
    const sendOptions: SendOptions = {
      ...this.queueOptions(job),
      ...(options.startAfter === undefined ? {} : { startAfter: options.startAfter }),
      ...(options.singletonKey === undefined ? {} : { singletonKey: options.singletonKey }),
      ...(options.priority === undefined ? {} : { priority: options.priority }),
      ...this.connection(),
    };
    const id = await this.instance().send(job.queue, parsed.data as object, sendOptions);
    this.logger.debug({ queue: job.queue, jobId: id }, 'job enqueued');
    return id;
  }

  /** Retry and expiry settings of a job, with defaults from configuration. */
  queueOptions(
    job: JobDefinition,
  ): Pick<SendOptions, 'retryLimit' | 'retryDelay' | 'retryBackoff' | 'expireInSeconds'> {
    const defaults = this.config.get('jobs');
    return {
      retryLimit: job.options.retryLimit ?? defaults.retryLimit,
      retryDelay: job.options.retryDelaySec ?? defaults.retryDelaySec,
      retryBackoff: job.options.retryBackoff ?? defaults.retryBackoff,
      expireInSeconds: job.options.expireSec ?? defaults.expireSec,
    };
  }

  /** Creates every defined queue (idempotent), so both processes can send and work. */
  private async createQueues(): Promise<void> {
    const boss = this.instance();
    const existing = new Set((await boss.getQueues()).map((queue) => queue.name));
    for (const job of registeredJobs()) {
      if (existing.has(job.queue)) continue;
      await boss.createQueue(job.queue, this.queueOptions(job));
    }
  }

  /** Uses the current transaction's connection when a transaction is active. */
  private connection(): ConnectionOptions {
    if (!this.txHost.isTransactionActive()) return {};
    const manager = this.txHost.tx;
    return {
      db: {
        executeSql: async (text, values) => {
          const rows: unknown[] = await manager.query(text, values);
          return { rows };
        },
      },
    };
  }
}
