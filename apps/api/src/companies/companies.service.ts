import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

const withContacts = {
  contacts: { include: { person: { select: { id: true, name: true } } } },
} satisfies Prisma.CompanyInclude;

type CompanyRow = {
  id: string;
  name: string;
  domain: string | null;
  address: string | null;
  phone: string | null;
  customFields: Prisma.JsonValue;
  contacts: { person: { id: string; name: string } }[];
};

function shape(c: CompanyRow) {
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    address: c.address,
    phone: c.phone,
    customFields: (c.customFields as Record<string, unknown>) ?? {},
    contacts: c.contacts.map((l) => l.person),
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Keep only person ids that belong to this tenant (prevents cross-tenant links). */
  private async validPersonIds(orgId: string, ids?: string[]): Promise<string[]> {
    if (!ids?.length) return [];
    const rows = await this.prisma.person.findMany({
      where: { orgId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  list(orgId: string) {
    return this.prisma.company
      .findMany({ where: { orgId, deletedAt: null }, orderBy: { name: 'asc' }, include: withContacts })
      .then((rows) => rows.map(shape));
  }

  async create(orgId: string, dto: CreateCompanyDto) {
    const contactIds = await this.validPersonIds(orgId, dto.contactIds);
    const row = await this.prisma.company.create({
      data: {
        orgId,
        name: dto.name,
        domain: dto.domain ?? null,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        contacts: { create: contactIds.map((personId) => ({ personId })) },
      },
      include: withContacts,
    });
    const company = shape(row);
    this.events.emit('webhook.event', { orgId, type: 'company.created', data: { company } });
    return company;
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.company.findFirst({
      where: { id, orgId, deletedAt: null },
      include: withContacts,
    });
    if (!row) throw new NotFoundException('Company not found');
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateCompanyDto) {
    await this.get(orgId, id);

    const data: Prisma.CompanyUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.domain !== undefined) data.domain = dto.domain;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.customFields !== undefined) data.customFields = dto.customFields as Prisma.InputJsonValue;
    await this.prisma.company.update({ where: { id }, data });

    if (dto.contactIds !== undefined) {
      const personIds = await this.validPersonIds(orgId, dto.contactIds);
      await this.prisma.companyContact.deleteMany({ where: { companyId: id } });
      if (personIds.length) {
        await this.prisma.companyContact.createMany({
          data: personIds.map((personId) => ({ companyId: id, personId })),
        });
      }
    }

    const row = await this.prisma.company.findFirstOrThrow({ where: { id }, include: withContacts });
    const company = shape(row);
    this.events.emit('webhook.event', { orgId, type: 'company.updated', data: { company } });
    return company;
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
