import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/organization.dto';

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  onboardingState: true,
  createdAt: true,
} as const;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** The current tenant (orgId comes from the JWT). */
  async get(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: PUBLIC_FIELDS,
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    await this.get(orgId);
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { name: dto.name },
      select: PUBLIC_FIELDS,
    });
  }
}
