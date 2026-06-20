import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { PipelinesService } from './pipelines.service';
import {
  CreatePipelineDto,
  CreateStageDto,
  UpdatePipelineDto,
  UpdateStageDto,
} from './dto/pipeline.dto';

@UseGuards(ApiAuthGuard)
@Controller()
export class PipelinesController {
  constructor(private readonly svc: PipelinesService) {}

  @Get('pipelines')
  @Scopes('deals:read')
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post('pipelines')
  @Scopes('pipelines:manage')
  create(@CurrentUser() u: AuthContext, @Body() dto: CreatePipelineDto) {
    return this.svc.create(u.orgId, dto);
  }

  @Get('pipelines/:id')
  @Scopes('deals:read')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  @Patch('pipelines/:id')
  @Scopes('pipelines:manage')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete('pipelines/:id')
  @Scopes('pipelines:manage')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }

  @Get('stages')
  @Scopes('deals:read')
  listAllStages(@CurrentUser() u: AuthContext) {
    return this.svc.listAllStages(u.orgId);
  }

  @Get('pipelines/:id/stages')
  @Scopes('deals:read')
  listStages(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.listStages(u.orgId, id);
  }

  @Post('pipelines/:id/stages')
  @Scopes('pipelines:manage')
  createStage(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: CreateStageDto) {
    return this.svc.createStage(u.orgId, id, dto);
  }

  @Patch('stages/:stageId')
  @Scopes('pipelines:manage')
  updateStage(
    @CurrentUser() u: AuthContext,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.svc.updateStage(u.orgId, stageId, dto);
  }

  @Delete('stages/:stageId')
  @Scopes('pipelines:manage')
  @HttpCode(204)
  removeStage(@CurrentUser() u: AuthContext, @Param('stageId') stageId: string) {
    return this.svc.removeStage(u.orgId, stageId);
  }
}
