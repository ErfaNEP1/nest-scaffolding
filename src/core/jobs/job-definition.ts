import type { z } from 'zod';

/** Retry and expiry settings of a queue. Unset values come from the JOBS_* configuration. */
export interface JobRetryOptions {
  retryLimit?: number;
  retryDelaySec?: number;
  retryBackoff?: boolean;
  expireSec?: number;
}

/**
 * A job type: queue name, payload schema and retry settings. Define it once, next to the
 * module that owns it, and use the same object to enqueue (API) and to handle (worker), so
 * producer and consumer can never disagree on the payload.
 */
export interface JobDefinition<TSchema extends z.ZodType = z.ZodType> {
  readonly queue: string;
  readonly payload: TSchema;
  readonly options: JobRetryOptions;
}

export type JobPayload<D extends JobDefinition> = z.infer<D['payload']>;

const QUEUE_NAME = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const registry = new Map<string, JobDefinition>();

/**
 * Declares a job type. Queue names are `<module>.<action>`, for example `sample.process`.
 * Payloads carry ids, never whole objects or secrets.
 */
export function defineJob<TSchema extends z.ZodType>(definition: {
  queue: string;
  payload: TSchema;
  options?: JobRetryOptions;
}): JobDefinition<TSchema> {
  if (!QUEUE_NAME.test(definition.queue)) {
    throw new Error(`Invalid queue name "${definition.queue}": use "<module>.<action>".`);
  }
  if (registry.has(definition.queue)) {
    throw new Error(`Job "${definition.queue}" is defined twice.`);
  }
  const job: JobDefinition<TSchema> = { ...definition, options: definition.options ?? {} };
  registry.set(job.queue, job);
  return job;
}

/** Every job defined so far (definitions register themselves when their file is loaded). */
export function registeredJobs(): JobDefinition[] {
  return [...registry.values()];
}
