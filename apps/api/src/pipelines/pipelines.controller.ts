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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { PipelinesService } from './pipelines.service';
import {
  CreatePipelineDto,
  CreateStageDto,
  UpdatePipelineDto,
  UpdateStageDto,
} from './dto/pipeline.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class PipelinesController {
  constructor(private readonly svc: PipelinesService) {}

  @Get('pipelines')
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post('pipelines')
  create(@CurrentUser() u: AuthContext, @Body() dto: CreatePipelineDto) {
    return this.svc.create(u.orgId, dto);
  }

  @Get('pipelines/:id')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  @Patch('pipelines/:id')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete('pipelines/:id')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }

  @Get('pipelines/:id/stages')
  listStages(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.listStages(u.orgId, id);
  }

  @Post('pipelines/:id/stages')
  createStage(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: CreateStageDto) {
    return this.svc.createStage(u.orgId, id, dto);
  }

  @Patch('stages/:stageId')
  updateStage(
    @CurrentUser() u: AuthContext,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.svc.updateStage(u.orgId, stageId, dto);
  }

  @Delete('stages/:stageId')
  @HttpCode(204)
  removeStage(@CurrentUser() u: AuthContext, @Param('stageId') stageId: string) {
    return this.svc.removeStage(u.orgId, stageId);
  }
}
