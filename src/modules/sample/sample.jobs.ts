import { z } from 'zod';
import { defineJob } from '../../core/jobs';

/** Marks a new sample as processed. Idempotent: running it twice changes nothing. */
export const processSampleJob = defineJob({
  queue: 'sample.process',
  payload: z.object({ sampleId: z.uuid() }),
  options: { retryLimit: 5, retryDelaySec: 10, retryBackoff: true, expireSec: 300 },
});
