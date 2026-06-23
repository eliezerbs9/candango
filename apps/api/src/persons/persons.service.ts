import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person.dto';

const withCompanies = {
  companyLinks: { include: { company: { select: { id: true, name: true } } } },
} satisfies Prisma.PersonInclude;

type PersonRow = {
  id: string;
  name: string;
  emails: Prisma.JsonValue;
  phones: Prisma.JsonValue;
  customFields: Prisma.JsonValue;
  companyLinks: { company: { id: string; name: string } }[];
};

function shape(p: PersonRow) {
  const emails = (p.emails as string[]) ?? [];
  const phones = (p.phones as string[]) ?? [];
  return {
    id: p.id,
    name: p.name,
    email: emails[0] ?? null,
    phone: phones[0] ?? null,
    customFields: (p.customFields as Record<string, unknown>) ?? {},
    companies: p.companyLinks.map((l) => l.company),
  };
}

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Keep only company ids that belong to this tenant (prevents cross-tenant links). */
  private async validCompanyIds(orgId: string, ids?: string[]): Promise<string[]> {
    if (!ids?.length) return [];
    const rows = await this.prisma.company.findMany({
      where: { orgId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async list(orgId: string) {
    const rows = await this.prisma.person.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: withCompanies,
    });
    return rows.map(shape);
  }

  async create(orgId: string, dto: CreatePersonDto) {
    const companyIds = await this.validCompanyIds(orgId, dto.companyIds);
    const row = await this.prisma.person.create({
      data: {
        orgId,
        name: dto.name,
        emails: dto.email ? [dto.email] : [],
        phones: dto.phone ? [dto.phone] : [],
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        companyLinks: { create: companyIds.map((companyId) => ({ companyId })) },
      },
      include: withCompanies,
    });
    const person = shape(row);
    this.events.emit('webhook.event', { orgId, type: 'person.created', data: { person } });
    return person;
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.person.findFirst({
      where: { id, orgId, deletedAt: null },
      include: withCompanies,
    });
    if (!row) throw new NotFoundException('Person not found');
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdatePersonDto) {
    await this.get(orgId, id);

    const data: Prisma.PersonUncheckedUpdateInput = { name: dto.name };
    if (dto.email !== undefined) data.emails = dto.email ? [dto.email] : [];
    if (dto.phone !== undefined) data.phones = dto.phone ? [dto.phone] : [];
    if (dto.customFields !== undefined) data.customFields = dto.customFields as Prisma.InputJsonValue;
    await this.prisma.person.update({ where: { id }, data });

    if (dto.companyIds !== undefined) {
      const companyIds = await this.validCompanyIds(orgId, dto.companyIds);
      await this.prisma.companyContact.deleteMany({ where: { personId: id } });
      if (companyIds.length) {
        await this.prisma.companyContact.createMany({
          data: companyIds.map((companyId) => ({ companyId, personId: id })),
        });
      }
    }

    const row = await this.prisma.person.findFirstOrThrow({ where: { id }, include: withCompanies });
    const person = shape(row);
    this.events.emit('webhook.event', { orgId, type: 'person.updated', data: { person } });
    return person;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.person.update({ where: { id }, data: { deletedAt: new Date() } });
    this.events.emit('webhook.event', { orgId, type: 'person.deleted', data: { id } });
  }
}
