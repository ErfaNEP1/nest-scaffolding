import type { SessionAwareTypeOrmAdapter } from './transactional-adapter';

export { Propagation, Transactional, TransactionHost } from '@nestjs-cls/transactional';

/**
 * Adapter type for transaction-aware database access. Inject the host in repositories and
 * use `txHost.tx` (the current transaction's EntityManager, or the default one outside a
 * transaction):
 *
 * ```ts
 * constructor(private readonly txHost: TransactionHost<DbAdapter>) {}
 * findById(id: string) { return this.txHost.tx.findOneBy(SampleEntity, { id }); }
 * ```
 */
export type DbAdapter = SessionAwareTypeOrmAdapter;
