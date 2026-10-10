export { DatabaseModule, type DatabaseModuleOptions, transactionalPlugin } from './database.module';
export { DbSessionContext, NoopDbSessionContext } from './db-session-context';
export { updateWithVersion, type Versioned } from './optimistic-lock';
export { mapPostgresError, PG_ERROR, pgErrorCode } from './pg-errors';
export { SnakeNamingStrategy, snakeCase } from './snake-naming.strategy';
export { type DbAdapter, Propagation, Transactional, TransactionHost } from './transactions';
