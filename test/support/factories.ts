import type { DataSource } from 'typeorm';
import { SampleEntity } from '../../src/modules/sample/sample.entity';
import { newId } from '../../src/shared/ids';

/** Inserts a sample row with sensible defaults. Delete this factory with the sample module. */
export async function createSample(
  dataSource: DataSource,
  overrides: Partial<SampleEntity> = {},
): Promise<SampleEntity> {
  const at = overrides.createdAt ?? new Date();
  const sample: SampleEntity = {
    id: newId(),
    ownerId: 'user-1',
    name: 'sample',
    description: null,
    status: 'new',
    rowVersion: 1,
    createdAt: at,
    updatedAt: at,
    processedAt: null,
    ...overrides,
  };
  await dataSource.manager.insert(SampleEntity, sample);
  return sample;
}
