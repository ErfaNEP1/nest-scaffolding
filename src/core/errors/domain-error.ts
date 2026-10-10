/** One validation problem, reported in Problem Details `errors`. */
export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

/**
 * Base class for errors that services throw on purpose. The global exception filter turns
 * them into Problem Details responses. `code` is a stable, machine-readable string
 * (UPPER_SNAKE_CASE) that clients can rely on; `status` is the HTTP status to answer with.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
  }

  get retryable(): boolean {
    return this.options.retryable ?? false;
  }
}

export class NotFoundError extends DomainError {
  constructor(code = 'NOT_FOUND', message = 'The resource was not found.') {
    super(code, message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(
    code = 'CONFLICT',
    message = 'The request conflicts with the current state of the resource.',
    options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    super(code, message, 409, options);
  }
}

export class ForbiddenError extends DomainError {
  constructor(code = 'FORBIDDEN', message = 'You are not allowed to perform this action.') {
    super(code, message, 403);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(code = 'UNAUTHORIZED', message = 'Authentication is required.') {
    super(code, message, 401);
  }
}

export class ValidationError extends DomainError {
  constructor(
    readonly issues: ValidationIssue[],
    code = 'VALIDATION_FAILED',
    message = 'The request is not valid.',
  ) {
    super(code, message, 400);
  }
}
