import { createCounter } from '../../core/observability';

export const samplesCreated = createCounter('app.sample.created', {
  description: 'Samples created.',
});
