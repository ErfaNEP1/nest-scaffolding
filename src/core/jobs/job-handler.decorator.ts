import { SetMetadata } from '@nestjs/common';
import type { JobDefinition } from './job-definition';

export const JOB_HANDLER = 'jobs:handler';

/** Settings for the worker that processes one queue. */
export interface JobWorkerOptions {
  /** Jobs of this queue processed in parallel by one worker process. Default: JOBS_CONCURRENCY. */
  concurrency?: number;
}

export interface JobHandlerMetadata {
  definition: JobDefinition;
  options: JobWorkerOptions;
}

/** Information about the job being processed, passed as the second handler argument. */
export interface JobInfo {
  id: string;
  queue: string;
  /** 0 on the first attempt. */
  retryCount: number;
  /** Aborted when the job expires or the worker stops. */
  signal: AbortSignal;
}

/**
 * Marks a provider method as the handler of a job. Discovered only in the worker process.
 * The payload is validated with the definition's schema before the method is called.
 *
 * ```ts
 * @JobHandler(processSampleJob)
 * async process(payload: JobPayload<typeof processSampleJob>, job: JobInfo) { ... }
 * ```
 */
export const JobHandler = (definition: JobDefinition, options: JobWorkerOptions = {}) =>
  SetMetadata<string, JobHandlerMetadata>(JOB_HANDLER, { definition, options });
