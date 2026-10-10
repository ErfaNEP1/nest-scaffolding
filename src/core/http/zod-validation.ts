import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';
import { type ValidationIssue, ValidationError } from '../errors/domain-error';

export function zodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Global pipe: validates `@Body()`, `@Query()` and `@Param()` typed with a Zod DTO
 * (`createZodDto`). Failures become a 400 Problem Details with `errors[]`.
 */
export const AppValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    error instanceof ZodError ? new ValidationError(zodIssues(error)) : new ValidationError([]),
});
