import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE } from './problem-details';

export { createZodDto, ZodResponse, ZodSerializerDto } from 'nestjs-zod';

/** Zod schema of the Problem Details body, published in the OpenAPI document. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  code: z.string().describe('Stable machine-readable error code.'),
  requestId: z.string(),
  retryable: z.boolean().optional(),
  errors: z
    .array(z.object({ path: z.string(), message: z.string(), code: z.string() }))
    .optional()
    .describe('Validation issues (only for validation errors).'),
});

/** Registered with Swagger as an extra model, so it appears as `ProblemDetails`. */
export class ProblemDetails extends createZodDto(problemDetailsSchema) {}

const DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed or the request is malformed.',
  401: 'Missing or invalid access token.',
  403: 'Not allowed.',
  404: 'Not found.',
  409: 'Conflict with the current state (for example a stale row version).',
  422: 'The data breaks a business or database constraint.',
};

/** Documents error responses as `application/problem+json` (ProblemDetails schema). */
export function ApiProblems(...statuses: number[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status] ?? 'Error.',
        content: {
          [PROBLEM_CONTENT_TYPE]: { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      }),
    ),
  );
}
