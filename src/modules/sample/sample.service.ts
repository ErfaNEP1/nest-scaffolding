import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Principal } from '../../core/auth';
import { Transactional } from '../../core/database';
import { ValidationError } from '../../core/errors';
import { JobsService } from '../../core/jobs';
import { newId } from '../../shared/ids';
import { type CursorPage, decodeCursor, toCursorPage } from '../../shared/pagination';
import { now, toIsoUtc } from '../../shared/time';
import type { SampleEntity } from './sample.entity';
import { SampleNotFoundError } from './sample.errors';
import { processSampleJob } from './sample.jobs';
import { samplesCreated } from './sample.metrics';
import { SampleRepository } from './sample.repository';

export const SAMPLE_ADMIN_ROLE = 'admin';

export interface CreateSampleInput {
  name: string;
  description?: string | undefined;
}

export interface UpdateSampleInput {
  name?: string | undefined;
  description?: string | null | undefined;
  rowVersion: number;
}

/**
 * Business logic of samples. Authorization is checked here for every access:
 * users see their own samples, admins see all.
 */
@Injectable()
export class SampleService {
  constructor(
    private readonly samples: SampleRepository,
    private readonly jobs: JobsService,
    @InjectPinoLogger(SampleService.name) private readonly logger: PinoLogger,
  ) {}

  /** Creates a sample and enqueues its processing in the same transaction. */
  @Transactional()
  async create(principal: Principal, input: CreateSampleInput): Promise<SampleEntity> {
    const timestamp = now();
    const sample = await this.samples.insert({
      id: newId(),
      ownerId: principal.subject,
      name: input.name,
      description: input.description ?? null,
      status: 'new',
      rowVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      processedAt: null,
    });
    await this.jobs.enqueue(processSampleJob, { sampleId: sample.id });
    samplesCreated.add(1);
    this.logger.info({ sampleId: sample.id }, 'sample created');
    return sample;
  }

  async get(principal: Principal, id: string): Promise<SampleEntity> {
    const sample = await this.samples.findById(id);
    if (!sample || !canAccess(principal, sample)) throw new SampleNotFoundError();
    return sample;
  }

  async list(
    principal: Principal,
    query: { limit: number; cursor?: string | undefined },
  ): Promise<CursorPage<SampleEntity>> {
    const after = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    if (after === null) {
      throw new ValidationError([
        { path: 'cursor', message: 'Invalid cursor.', code: 'invalid_cursor' },
      ]);
    }
    const rows = await this.samples.list({
      ownerId: isAdmin(principal) ? undefined : principal.subject,
      limit: query.limit,
      after,
    });
    return toCursorPage(rows, query.limit, (row) => ({
      sortValue: toIsoUtc(row.createdAt),
      id: row.id,
    }));
  }

  @Transactional()
  async update(principal: Principal, id: string, input: UpdateSampleInput): Promise<SampleEntity> {
    await this.get(principal, id);
    const changes: Parameters<SampleRepository['update']>[2] = { updatedAt: now() };
    if (input.name !== undefined) changes.name = input.name;
    if (input.description !== undefined) changes.description = input.description;
    const updated = await this.samples.update(id, input.rowVersion, changes);
    this.logger.info({ sampleId: id, rowVersion: updated.rowVersion }, 'sample updated');
    return updated;
  }

  /** Job step. Safe to run more than once: only a `new` sample changes. */
  @Transactional()
  async markProcessed(sampleId: string): Promise<void> {
    const changed = await this.samples.markProcessed(sampleId, now());
    this.logger.info(
      { sampleId, changed },
      changed ? 'sample processed' : 'sample already processed or gone',
    );
  }
}

function isAdmin(principal: Principal): boolean {
  return principal.roles.includes(SAMPLE_ADMIN_ROLE);
}

function canAccess(principal: Principal, sample: SampleEntity): boolean {
  return isAdmin(principal) || sample.ownerId === principal.subject;
}
