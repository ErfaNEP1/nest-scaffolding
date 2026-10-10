import { Injectable } from '@nestjs/common';
import { type DbAdapter, TransactionHost, updateWithVersion } from '../../core/database';
import type { CursorPosition } from '../../shared/pagination';
import { SampleEntity } from './sample.entity';
import { SampleNotFoundError } from './sample.errors';

export interface SampleListFilter {
  /** Only samples of this owner; undefined lists all owners. */
  ownerId: string | undefined;
  limit: number;
  /** Keyset position after which to continue (from the previous page). */
  after: CursorPosition | undefined;
}

/** Data access for `samples`. No business rules here; always use the transaction-aware manager. */
@Injectable()
export class SampleRepository {
  constructor(private readonly txHost: TransactionHost<DbAdapter>) {}

  private get manager() {
    return this.txHost.tx;
  }

  async insert(sample: SampleEntity): Promise<SampleEntity> {
    await this.manager.insert(SampleEntity, sample);
    return sample;
  }

  findById(id: string): Promise<SampleEntity | null> {
    return this.manager.findOneBy(SampleEntity, { id });
  }

  /**
   * Keyset pagination, newest first, ordered by (created_at, id). Fetches `limit + 1` rows
   * so the caller can tell whether there is a next page.
   */
  list(filter: SampleListFilter): Promise<SampleEntity[]> {
    const query = this.manager
      .createQueryBuilder(SampleEntity, 'sample')
      .orderBy('sample.createdAt', 'DESC')
      .addOrderBy('sample.id', 'DESC')
      .limit(filter.limit + 1);
    if (filter.ownerId !== undefined) {
      query.andWhere('sample.ownerId = :ownerId', { ownerId: filter.ownerId });
    }
    if (filter.after) {
      query.andWhere('(sample.createdAt, sample.id) < (:afterCreatedAt, :afterId)', {
        afterCreatedAt: filter.after.sortValue,
        afterId: filter.after.id,
      });
    }
    return query.getMany();
  }

  /** Updates if `rowVersion` matches; 404 / 409 (`VERSION_CONFLICT`) otherwise. */
  update(
    id: string,
    rowVersion: number,
    changes: Partial<Pick<SampleEntity, 'name' | 'description' | 'updatedAt'>>,
  ): Promise<SampleEntity> {
    return updateWithVersion(
      this.manager,
      SampleEntity,
      id,
      rowVersion,
      changes,
      () => new SampleNotFoundError(),
    );
  }

  /** Sets status `processed` only if it is still `new`. Returns false if nothing changed. */
  async markProcessed(id: string, at: Date): Promise<boolean> {
    const result = await this.manager
      .createQueryBuilder()
      .update(SampleEntity)
      .set({
        status: 'processed',
        processedAt: at,
        updatedAt: at,
        rowVersion: () => 'row_version + 1',
      })
      .where('id = :id AND status = :status', { id, status: 'new' })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
