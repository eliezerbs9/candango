import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function asObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Onboarding checklist — most flags are derived from real data. */
  async get(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { onboardingState: true, logoUrl: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const [pipelineCount, userCount] = await Promise.all([
      this.prisma.pipeline.count({ where: { orgId, deletedAt: null } }),
      this.prisma.user.count({ where: { orgId, deletedAt: null } }),
    ]);

    const state = asObject(org.onboardingState);
    return {
      pipelineCreated: pipelineCount > 0,
      teammatesInvited: userCount > 1,
      brandingSet: !!org.logoUrl,
      completed: state.completed === true,
    };
  }

  async update(orgId: string, completed?: boolean) {
    if (completed !== undefined) {
      const org = await this.prisma.organization.findFirst({
        where: { id: orgId, deletedAt: null },
        select: { onboardingState: true },
      });
      if (!org) throw new NotFoundException('Organization not found');
      const prev = asObject(org.onboardingState);
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { onboardingState: { ...prev, completed } as Prisma.InputJsonValue },
      });
    }
    return this.get(orgId);
  }
}
