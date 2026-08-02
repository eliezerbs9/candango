import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/organization.dto';
import { normalizeSignatureConfig } from '../email-templates/template-vars';

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  logoUrl: true,
  qboNameFormat: true,
  taxRateBps: true,
  taxDefaultOn: true,
  emailSignature: true,
  onboardingState: true,
  createdAt: true,
} as const;

// Always hand the client a complete signature config (default when unset).
const shape = <T extends { emailSignature: unknown }>(org: T) => ({
  ...org,
  emailSignature: normalizeSignatureConfig(org.emailSignature),
});

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
    return shape(org);
  }

  /** Active members of the tenant — for assignee pickers, etc. */
  async members(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    await this.get(orgId);
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        qboNameFormat: dto.qboNameFormat,
        taxRateBps: dto.taxRateBps,
        taxDefaultOn: dto.taxDefaultOn,
        ...(dto.emailSignature !== undefined
          ? { emailSignature: normalizeSignatureConfig(dto.emailSignature) as unknown as Prisma.InputJsonValue }
          : {}),
      },
      select: PUBLIC_FIELDS,
    });
    return shape(org);
  }
}
