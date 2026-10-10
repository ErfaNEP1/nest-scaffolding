import { Injectable, type INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { z } from 'zod';
import { ConfigModule } from '../../../src/config';
import { contextModule, currentContext } from '../../../src/core/context';
import { DatabaseModule, Transactional, transactionalPlugin } from '../../../src/core/database';
import {
  defineJob,
  JobHandler,
  type JobInfo,
  type JobPayload,
  JobsModule,
  JobsService,
} from '../../../src/core/jobs';
import { loggerModule } from '../../../src/core/logging';
import { testConfig } from '../../support/test-config';
import { waitFor } from '../../support/wait-for';

const echoJob = defineJob({
  queue: 'test.echo',
  payload: z.object({ value: z.string(), failTimes: z.number().int().default(0) }),
  options: { retryLimit: 2, retryDelaySec: 0, retryBackoff: false },
});

interface Attempt {
  value: string;
  retryCount: number;
  jobId: string | undefined;
  queue: string | undefined;
}

@Injectable()
class EchoHandler {
  readonly attempts: Attempt[] = [];

  @JobHandler(echoJob)
  handle(payload: JobPayload<typeof echoJob>, job: JobInfo): Promise<void> {
    const { jobId, queue } = currentContext();
    this.attempts.push({ value: payload.value, retryCount: job.retryCount, jobId, queue });
    if (job.retryCount < payload.failTimes) return Promise.reject(new Error('forced failure'));
    return Promise.resolve();
  }
}

@Injectable()
class Producer {
  constructor(private readonly jobs: JobsService) {}

  @Transactional()
  async enqueueThenFail(value: string): Promise<void> {
    await this.jobs.enqueue(echoJob, { value, failTimes: 0 });
    throw new Error('rollback');
  }
}

describe('jobs (pg-boss)', () => {
  let app: INestApplicationContext;
  let handler: EchoHandler;
  let jobs: JobsService;

  beforeAll(async () => {
    const config = testConfig({ DATABASE_URL: inject('databaseUrl') });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        contextModule([transactionalPlugin()]),
        loggerModule(),
        DatabaseModule.forRoot(),
        JobsModule.forRoot({ role: 'worker', start: true }),
      ],
      providers: [EchoHandler, Producer],
    }).compile();
    app = await moduleRef.init();
    handler = app.get(EchoHandler);
    jobs = app.get(JobsService);
  });

  afterAll(async () => {
    await app.close();
  });

  const attemptsFor = (value: string) => handler.attempts.filter((a) => a.value === value);

  it('processes an enqueued job inside a job context', async () => {
    const id = await jobs.enqueue(echoJob, { value: 'hello', failTimes: 0 });
    const [attempt] = await waitFor(
      () => attemptsFor('hello').length === 1 && attemptsFor('hello'),
    );
    expect(attempt).toEqual({ value: 'hello', retryCount: 0, jobId: id, queue: 'test.echo' });
  });

  it('retries a failing job', async () => {
    await jobs.enqueue(echoJob, { value: 'flaky', failTimes: 1 });
    const attempts = await waitFor(() => attemptsFor('flaky').length === 2 && attemptsFor('flaky'));
    expect(attempts.map((a) => a.retryCount)).toEqual([0, 1]);
  });

  it('validates the payload when enqueuing', async () => {
    await expect(
      jobs.enqueue(echoJob, { value: 42 } as unknown as JobPayload<typeof echoJob>),
    ).rejects.toMatchObject({ code: 'INVALID_JOB_PAYLOAD' });
  });

  it('drops a job enqueued in a transaction that rolls back', async () => {
    await expect(app.get(Producer).enqueueThenFail('rolled-back')).rejects.toThrow('rollback');
    const rows: { count: string }[] = await app
      .get(DataSource)
      .query(
        `SELECT count(*) FROM pgboss.job WHERE name = 'test.echo' AND data->>'value' = 'rolled-back'`,
      );
    expect(rows[0]?.count).toBe('0');
    expect(attemptsFor('rolled-back')).toEqual([]);
  });
});
