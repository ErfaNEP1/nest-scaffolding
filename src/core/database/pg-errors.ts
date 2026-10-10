import { QueryFailedError } from 'typeorm';
import { ConflictError, DomainError } from '../errors/domain-error';

/** PostgreSQL SQLSTATE codes the application gives a meaning to. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  QUERY_CANCELED: '57014',
} as const;

/** SQLSTATE of a database error, or undefined for any other error. */
export function pgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  const driverError: unknown = error.driverError;
  if (driverError && typeof driverError === 'object' && 'code' in driverError) {
    return typeof driverError.code === 'string' ? driverError.code : undefined;
  }
  return undefined;
}

/**
 * Maps common PostgreSQL errors to domain errors. This is the single place that knows the
 * mapping; the HTTP filter calls it for every unhandled error. Messages never include SQL.
 * Services that need a specific code (for example `EMAIL_TAKEN`) catch the error and use
 * {@link pgErrorCode} themselves.
 */
export function mapPostgresError(error: unknown): DomainError | null {
  const code = pgErrorCode(error);
  switch (code) {
    case PG_ERROR.UNIQUE_VIOLATION:
      return new ConflictError(
        'UNIQUE_VIOLATION',
        'A resource with the same unique value already exists.',
        { cause: error },
      );
    case PG_ERROR.FOREIGN_KEY_VIOLATION:
      return new ConflictError(
        'REFERENCE_CONFLICT',
        'The request refers to a resource that does not exist or is still in use.',
        { cause: error },
      );
    case PG_ERROR.CHECK_VIOLATION:
    case PG_ERROR.NOT_NULL_VIOLATION:
      return new DomainError(
        'CONSTRAINT_VIOLATION',
        'The data breaks a database constraint.',
        422,
        { cause: error },
      );
    case PG_ERROR.SERIALIZATION_FAILURE:
    case PG_ERROR.DEADLOCK_DETECTED:
      return new ConflictError(
        'CONCURRENT_UPDATE',
        'The resource was changed at the same time by another request. Retry the request.',
        { cause: error, retryable: true },
      );
    case PG_ERROR.QUERY_CANCELED:
      return new DomainError('QUERY_TIMEOUT', 'The request took too long. Retry later.', 503, {
        cause: error,
        retryable: true,
      });
    default:
      return null;
  }
}
