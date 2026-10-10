import { Injectable } from '@nestjs/common';
import { JobHandler, type JobInfo, type JobPayload } from '../../core/jobs';
import { processSampleJob } from './sample.jobs';
import { SampleService } from './sample.service';

/** Runs in the worker process only. */
@Injectable()
export class SampleJobHandler {
  constructor(private readonly samples: SampleService) {}

  @JobHandler(processSampleJob)
  async process(payload: JobPayload<typeof processSampleJob>, _job: JobInfo): Promise<void> {
    await this.samples.markProcessed(payload.sampleId);
  }
}
