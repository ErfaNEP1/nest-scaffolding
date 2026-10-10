import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { ConflictError, NotFoundError } from '../errors/domain-error';

/** Entities that use optimistic locking have an `id` and a `rowVersion` (`row_version`) column. */
export interface Versioned extends ObjectLiteral {
  id: string;
  rowVersion: number;
}

/**
 * Updates one row only if its `row_version` still equals `expectedVersion`, and increments it.
 * Throws `NotFoundError` if the row does not exist and `ConflictError` (`VERSION_CONFLICT`)
 * if someone else changed it first. Returns the updated entity.
 */
export async function updateWithVersion<T extends Versioned>(
  manager: EntityManager,
  target: EntityTarget<T>,
  id: string,
  expectedVersion: number,
  changes: QueryDeepPartialEntity<T>,
  notFound: () => NotFoundError = () => new NotFoundError(),
): Promise<T> {
  const result = await manager
    .createQueryBuilder()
    .update(target)
    .set({ ...changes, rowVersion: () => 'row_version + 1' })
    .where('id = :id AND row_version = :expectedVersion', { id, expectedVersion })
    .execute();

  const current = await manager
    .getRepository(target)
    .createQueryBuilder('entity')
    .where('entity.id = :id', { id })
    .getOne();
  if (!current) throw notFound();
  if (result.affected === 0) {
    throw new ConflictError(
      'VERSION_CONFLICT',
      `The resource was changed by someone else (expected version ${expectedVersion}, current version ${current.rowVersion}). Reload it and try again.`,
    );
  }
  return current;
}
