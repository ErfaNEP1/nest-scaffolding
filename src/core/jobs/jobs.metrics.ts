import { createCounter, createHistogram, DURATION_BUCKETS_SECONDS } from '../observability/metrics';

type Outcome = { queue: string; outcome: 'completed' | 'failed' };

export const jobsProcessed = createCounter<Outcome>('jobs.processed', {
  description: 'Jobs processed by the worker, by queue and outcome (completed or failed).',
  labels: ['queue', 'outcome'],
});

export const jobsRetried = createCounter<{ queue: string }>('jobs.retried', {
  description: 'Job attempts that were retries (retry count above 0), by queue.',
  labels: ['queue'],
});

export const jobDuration = createHistogram<Outcome>('jobs.duration', {
  description: 'Job processing time, by queue and outcome.',
  unit: 's',
  advice: { explicitBucketBoundaries: DURATION_BUCKETS_SECONDS },
  labels: ['queue', 'outcome'],
});
