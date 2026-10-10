import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type Principal, Roles } from '../../core/auth';
import { ApiProblems, ZodResponse } from '../../core/http';
import {
  CreateSampleRequest,
  ListSamplesQuery,
  SampleIdParams,
  SamplePageResponse,
  SampleResponse,
  toSampleResponse,
  UpdateSampleRequest,
} from './sample.dto';
import { SAMPLE_ADMIN_ROLE } from './sample.service';
import { SampleService } from './sample.service';

/** HTTP mapping only: no business logic here. */
@ApiTags('samples')
@ApiProblems(400, 401, 403)
@Roles('user', SAMPLE_ADMIN_ROLE)
@Controller({ path: 'samples', version: '1' })
export class SampleController {
  constructor(private readonly samples: SampleService) {}

  @Post()
  @HttpCode(201)
  @ZodResponse({ status: 201, description: 'Sample created.', type: SampleResponse })
  async create(@CurrentUser() user: Principal, @Body() body: CreateSampleRequest) {
    return toSampleResponse(await this.samples.create(user, body));
  }

  @Get()
  @ZodResponse({
    status: 200,
    description: 'Page of samples, newest first.',
    type: SamplePageResponse,
  })
  async list(@CurrentUser() user: Principal, @Query() query: ListSamplesQuery) {
    const page = await this.samples.list(user, query);
    return { items: page.items.map(toSampleResponse), nextCursor: page.nextCursor };
  }

  @Get(':id')
  @ApiProblems(404)
  @ZodResponse({ status: 200, description: 'The sample.', type: SampleResponse })
  async get(@CurrentUser() user: Principal, @Param() params: SampleIdParams) {
    return toSampleResponse(await this.samples.get(user, params.id));
  }

  @Patch(':id')
  @ApiProblems(404, 409)
  @ZodResponse({ status: 200, description: 'The updated sample.', type: SampleResponse })
  async update(
    @CurrentUser() user: Principal,
    @Param() params: SampleIdParams,
    @Body() body: UpdateSampleRequest,
  ) {
    return toSampleResponse(await this.samples.update(user, params.id, body));
  }
}
