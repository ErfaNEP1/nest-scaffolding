import { z } from 'zod';
import { createZodDto } from '../../core/http';
import { toIsoUtc } from '../../shared/time';
import { SAMPLE_STATUSES, type SampleEntity } from './sample.entity';

const name = z.string().trim().min(1).max(200);
const description = z.string().trim().max(2000);

export const sampleResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(SAMPLE_STATUSES),
  rowVersion: z.number().int().describe('Send it back when updating (optimistic locking).'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
});

export class SampleResponse extends createZodDto(sampleResponseSchema) {}

export class SamplePageResponse extends createZodDto(
  z.object({
    items: z.array(sampleResponseSchema),
    nextCursor: z.string().nullable().describe('Pass as `cursor` to get the next page.'),
  }),
) {}

export class CreateSampleRequest extends createZodDto(
  z.object({ name, description: description.optional() }),
) {}

export class UpdateSampleRequest extends createZodDto(
  z
    .object({
      name: name.optional(),
      description: description.nullable().optional(),
      rowVersion: z.number().int().positive(),
    })
    .refine((body) => body.name !== undefined || body.description !== undefined, {
      message: 'Change at least one of name or description.',
    }),
) {}

export class ListSamplesQuery extends createZodDto(
  z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).max(500).optional(),
  }),
) {}

export class SampleIdParams extends createZodDto(z.object({ id: z.uuid() })) {}

export function toSampleResponse(sample: SampleEntity): z.input<typeof sampleResponseSchema> {
  return {
    id: sample.id,
    name: sample.name,
    description: sample.description,
    status: sample.status,
    rowVersion: sample.rowVersion,
    createdAt: toIsoUtc(sample.createdAt),
    updatedAt: toIsoUtc(sample.updatedAt),
    processedAt: sample.processedAt ? toIsoUtc(sample.processedAt) : null,
  };
}
