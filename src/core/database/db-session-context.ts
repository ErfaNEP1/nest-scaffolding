import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/**
 * Called at the start of every transaction, on the transaction's connection, before any
 * work runs. Use it to set session settings, for example for row-level security:
 *
 * ```ts
 * @Injectable()
 * export class RlsSessionContext extends DbSessionContext {
 *   override async apply(manager: EntityManager): Promise<void> {
 *     await manager.query(`SELECT set_config('app.user_id', $1, true)`, [currentContext().userId ?? '']);
 *   }
 * }
 * // DatabaseModule.forRoot({ sessionContext: RlsSessionContext })
 * ```
 *
 * Use `set_config(..., true)` (transaction-local) so values never leak to the next user of
 * the pooled connection.
 */
export abstract class DbSessionContext {
  abstract apply(manager: EntityManager): Promise<void>;
}

/** Default: no session settings. */
@Injectable()
export class NoopDbSessionContext extends DbSessionContext {
  override async apply(): Promise<void> {
    // Nothing to set by default.
  }
}
