import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePipelineDto,
  CreateStageDto,
  UpdatePipelineDto,
  UpdateStageDto,
} from './dto/pipeline.dto';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.pipeline.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { position: 'asc' },
    });
  }

  create(orgId: string, dto: CreatePipelineDto) {
    return this.prisma.pipeline.create({
      data: {
        orgId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        position: dto.position ?? 0,
      },
    });
  }

  async get(orgId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async update(orgId: string, id: string, dto: UpdatePipelineDto) {
    await this.get(orgId, id);
    return this.prisma.pipeline.update({ where: { id }, data: { ...dto } });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.pipeline.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // --- Stages ---

  listAllStages(orgId: string) {
    return this.prisma.stage.findMany({
      where: { orgId },
      orderBy: [{ pipelineId: 'asc' }, { position: 'asc' }],
    });
  }

  async listStages(orgId: string, pipelineId: string) {
    await this.get(orgId, pipelineId);
    return this.prisma.stage.findMany({
      where: { orgId, pipelineId },
      orderBy: { position: 'asc' },
    });
  }

  async createStage(orgId: string, pipelineId: string, dto: CreateStageDto) {
    await this.get(orgId, pipelineId);
    return this.prisma.stage.create({
      data: {
        orgId,
        pipelineId,
        name: dto.name,
        position: dto.position ?? 0,
        probability: dto.probability ?? 0,
        rottingDays: dto.rottingDays ?? null,
      },
    });
  }

  async updateStage(orgId: string, stageId: string, dto: UpdateStageDto) {
    await this.getStage(orgId, stageId);
    return this.prisma.stage.update({ where: { id: stageId }, data: { ...dto } });
  }

  async removeStage(orgId: string, stageId: string) {
    await this.getStage(orgId, stageId);
    await this.prisma.stage.delete({ where: { id: stageId } });
  }

  private async getStage(orgId: string, stageId: string) {
    const stage = await this.prisma.stage.findFirst({ where: { id: stageId, orgId } });
    if (!stage) throw new NotFoundException('Stage not found');
    return stage;
  }
}
