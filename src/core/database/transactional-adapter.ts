import type { TransactionalAdapter } from '@nestjs-cls/transactional';
import type { DataSource, EntityManager } from 'typeorm';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel.js';
import type { DbSessionContext } from './db-session-context';

/** Token of the provider that gives the adapter the DataSource and the session hook. */
export const TRANSACTION_CONNECTION = Symbol('TRANSACTION_CONNECTION');

export interface TransactionConnection {
  dataSource: DataSource;
  sessionContext: DbSessionContext;
}

export interface TransactionOptions {
  isolationLevel: IsolationLevel;
}

/**
 * TypeORM adapter for `@nestjs-cls/transactional` that runs {@link DbSessionContext} at the
 * start of every (outer) transaction. Nested `@Transactional()` calls use savepoints.
 */
export class SessionAwareTypeOrmAdapter implements TransactionalAdapter<
  TransactionConnection,
  EntityManager,
  TransactionOptions
> {
  readonly connectionToken = TRANSACTION_CONNECTION;

  readonly optionsFactory = ({ dataSource, sessionContext }: TransactionConnection) => ({
    wrapWithTransaction: (
      options: Partial<TransactionOptions> | undefined,
      fn: () => Promise<unknown>,
      setClient: (client?: EntityManager) => void,
    ) =>
      dataSource.transaction(options?.isolationLevel ?? 'READ COMMITTED', async (manager) => {
        await sessionContext.apply(manager);
        setClient(manager);
        return fn();
      }),
    wrapWithNestedTransaction: (
      options: Partial<TransactionOptions> | undefined,
      fn: () => Promise<unknown>,
      setClient: (client?: EntityManager) => void,
      client: EntityManager,
    ) =>
      client.transaction(options?.isolationLevel ?? 'READ COMMITTED', (manager) => {
        setClient(manager);
        return fn();
      }),
    getFallbackInstance: () => dataSource.manager,
  });
}
