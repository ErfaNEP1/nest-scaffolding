import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SampleController } from './sample.controller';
import { SampleEntity } from './sample.entity';
import { SampleJobHandler } from './sample.job-handler';
import { SampleRepository } from './sample.repository';
import { SampleService } from './sample.service';

@Module({
  imports: [TypeOrmModule.forFeature([SampleEntity])],
  controllers: [SampleController],
  providers: [SampleRepository, SampleService, SampleJobHandler],
  exports: [SampleService],
})
export class SampleModule {}
