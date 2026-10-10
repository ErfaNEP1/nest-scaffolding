import { NotFoundError } from '../../core/errors';

/** Also used when the sample exists but belongs to someone else, so ids cannot be probed. */
export class SampleNotFoundError extends NotFoundError {
  constructor() {
    super('SAMPLE_NOT_FOUND', 'The sample was not found.');
  }
}
