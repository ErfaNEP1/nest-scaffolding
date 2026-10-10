import { Test } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unitTestContextModule } from '../../../test/support/transactions';
import type { Principal } from '../../core/auth';
import { JobsService } from '../../core/jobs';
import { encodeCursor } from '../../shared/pagination';
import type { SampleEntity } from './sample.entity';
import { processSampleJob } from './sample.jobs';
import { SampleRepository } from './sample.repository';
import { SampleService } from './sample.service';

const alice: Principal = { subject: 'alice', roles: ['user'], claims: {} };
const bob: Principal = { subject: 'bob', roles: ['user'], claims: {} };
const admin: Principal = { subject: 'root', roles: ['admin'], claims: {} };

function sample(overrides: Partial<SampleEntity> = {}): SampleEntity {
  const at = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: '01970000-0000-7000-8000-000000000001',
    ownerId: 'alice',
    name: 'first',
    description: null,
    status: 'new',
    rowVersion: 1,
    createdAt: at,
    updatedAt: at,
    processedAt: null,
    ...overrides,
  };
}

describe('SampleService', () => {
  let service: SampleService;
  const repository = {
    insert: vi.fn((entity: SampleEntity) => Promise.resolve(entity)),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    markProcessed: vi.fn(),
  };
  const jobs = { enqueue: vi.fn(() => Promise.resolve('job-1')) };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [unitTestContextModule()],
      providers: [
        SampleService,
        { provide: SampleRepository, useValue: repository },
        { provide: JobsService, useValue: jobs },
        { provide: getLoggerToken(SampleService.name), useValue: logger },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(SampleService);
  });

  it('creates a sample owned by the caller and enqueues its processing', async () => {
    const created = await service.create(alice, { name: 'one' });
    expect(created).toMatchObject({ ownerId: 'alice', name: 'one', status: 'new', rowVersion: 1 });
    expect(jobs.enqueue).toHaveBeenCalledWith(processSampleJob, { sampleId: created.id });
  });

  it('hides samples of other users as not found', async () => {
    repository.findById.mockResolvedValue(sample({ ownerId: 'alice' }));
    await expect(service.get(bob, 'id')).rejects.toMatchObject({ code: 'SAMPLE_NOT_FOUND' });
    await expect(service.get(admin, 'id')).resolves.toMatchObject({ ownerId: 'alice' });
  });

  it('lists only the caller’s samples, admins see all', async () => {
    repository.list.mockResolvedValue([]);
    await service.list(alice, { limit: 10 });
    expect(repository.list).toHaveBeenLastCalledWith({
      ownerId: 'alice',
      limit: 10,
      after: undefined,
    });
    await service.list(admin, { limit: 10 });
    expect(repository.list).toHaveBeenLastCalledWith({
      ownerId: undefined,
      limit: 10,
      after: undefined,
    });
  });

  it('decodes the cursor and rejects malformed ones', async () => {
    repository.list.mockResolvedValue([]);
    const cursor = encodeCursor({ sortValue: '2026-01-01T00:00:00.000Z', id: 'x' });
    await service.list(alice, { limit: 5, cursor });
    expect(repository.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: { sortValue: '2026-01-01T00:00:00.000Z', id: 'x' } }),
    );
    await expect(service.list(alice, { limit: 5, cursor: 'garbage' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('builds the next cursor from the last item', async () => {
    const rows = [sample({ id: 'a' }), sample({ id: 'b' }), sample({ id: 'c' })];
    repository.list.mockResolvedValue(rows);
    const page = await service.list(alice, { limit: 2 });
    expect(page.items.map((s) => s.id)).toEqual(['a', 'b']);
    expect(page.nextCursor).toBe(encodeCursor({ sortValue: '2026-01-01T00:00:00.000Z', id: 'b' }));
  });

  it('checks access before updating and passes the expected row version', async () => {
    repository.findById.mockResolvedValue(sample({ ownerId: 'bob' }));
    await expect(service.update(alice, 'id', { name: 'x', rowVersion: 1 })).rejects.toMatchObject({
      code: 'SAMPLE_NOT_FOUND',
    });
    expect(repository.update).not.toHaveBeenCalled();

    repository.findById.mockResolvedValue(sample());
    repository.update.mockResolvedValue(sample({ name: 'x', rowVersion: 2 }));
    await service.update(alice, 'id', { name: 'x', rowVersion: 1 });
    expect(repository.update).toHaveBeenCalledWith('id', 1, expect.objectContaining({ name: 'x' }));
  });
});
