import { Column, Entity, PrimaryColumn } from 'typeorm';

export const SAMPLE_STATUSES = ['new', 'processed'] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

/** Row of `samples` (db/migrations/0002_sample.sql). Columns map to snake_case. */
@Entity({ name: 'samples' })
export class SampleEntity {
  @PrimaryColumn('uuid')
  id!: string;

  /** `sub` of the user who created it. */
  @Column('text')
  ownerId!: string;

  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('text')
  status!: SampleStatus;

  /** Optimistic locking: incremented on every update. */
  @Column('integer')
  rowVersion!: number;

  @Column('timestamptz')
  createdAt!: Date;

  @Column('timestamptz')
  updatedAt!: Date;

  @Column('timestamptz', { nullable: true })
  processedAt!: Date | null;
}
