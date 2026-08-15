import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/organization.dto';
import { normalizeSignature } from '../email-templates/template-vars';
import { formatPersonName } from '../persons/name-format';

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  logoUrl: true,
  qboNameFormat: true,
  timezone: true,
  taxRateBps: true,
  taxDefaultOn: true,
  emailSignature: true,
  winRequirements: true,
  dealCardConfig: true,
  onboardingState: true,
  createdAt: true,
} as const;

// Always hand the client a signature string (the default HTML when unset).
const shape = <T extends { emailSignature: unknown }>(org: T) => ({
  ...org,
  emailSignature: normalizeSignature(org.emailSignature),
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
    const before = await this.get(orgId);
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        qboNameFormat: dto.qboNameFormat,
        ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() || null } : {}),
        taxRateBps: dto.taxRateBps,
        taxDefaultOn: dto.taxDefaultOn,
        ...(dto.emailSignature !== undefined
          ? { emailSignature: dto.emailSignature as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.dealCardConfig !== undefined
          ? { dealCardConfig: dto.dealCardConfig as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.winRequirements !== undefined
          ? { winRequirements: dto.winRequirements as unknown as Prisma.InputJsonValue }
          : {}),
      },
      select: PUBLIC_FIELDS,
    });
    // Changing the contact-name format re-derives every existing Person.name.
    if (dto.qboNameFormat && dto.qboNameFormat !== before.qboNameFormat) {
      await this.recomputePersonNames(orgId, dto.qboNameFormat);
    }
    return shape(org);
  }

  /** Rewrite every contact's derived display name in the workspace's chosen format. */
  private async recomputePersonNames(orgId: string, format: string) {
    const persons = await this.prisma.person.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, name: true },
    });
    await Promise.all(
      persons
        .map((p) => ({ id: p.id, next: formatPersonName(p.firstName, p.lastName, format) }))
        .filter((p, i) => p.next !== persons[i].name)
        .map((p) => this.prisma.person.update({ where: { id: p.id }, data: { name: p.next } })),
    );
  }
}
