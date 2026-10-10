import { type DynamicModule, Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ReadinessCheck } from '../health/readiness-check';
import { JobWorker } from './job-worker';
import { JobsReadinessCheck } from './jobs.readiness';
import { JOBS_OPTIONS, type JobsModuleOptions, JobsService } from './jobs.service';

/** Background jobs with pg-boss. `role: 'worker'` also runs `@JobHandler` methods. */
@Global()
@Module({})
export class JobsModule {
  static forRoot(options: JobsModuleOptions): DynamicModule {
    const worker = options.role === 'worker';
    return {
      module: JobsModule,
      imports: [TerminusModule, ...(worker ? [DiscoveryModule] : [])],
      providers: [
        { provide: JOBS_OPTIONS, useValue: options },
        JobsService,
        { provide: ReadinessCheck, useClass: JobsReadinessCheck },
        ...(worker ? [JobWorker] : []),
      ],
      exports: [JobsService, ReadinessCheck],
    };
  }
}
