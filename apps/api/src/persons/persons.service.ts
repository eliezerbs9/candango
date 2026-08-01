import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person.dto';

const withCompanies = {
  companyLinks: { include: { company: { select: { id: true, name: true } } } },
} satisfies Prisma.PersonInclude;

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  emails: Prisma.JsonValue;
  phones: Prisma.JsonValue;
  address: Prisma.JsonValue;
  customFields: Prisma.JsonValue;
  companyLinks: { company: { id: string; name: string } }[];
};

function shape(p: PersonRow) {
  const emails = (p.emails as string[]) ?? [];
  const phones = (p.phones as string[]) ?? [];
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    name: p.name,
    email: emails[0] ?? null,
    phone: phones[0] ?? null,
    address: p.address ?? null,
    customFields: (p.customFields as Record<string, unknown>) ?? {},
    companies: p.companyLinks.map((l) => l.company),
  };
}

/** Split a typed full name: first whitespace token → first, the rest → last. */
function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim().replace(/\s+/g, ' ');
  const i = t.indexOf(' ');
  return i === -1 ? { firstName: t, lastName: '' } : { firstName: t.slice(0, i), lastName: t.slice(i + 1) };
}

/**
 * Resolve firstName/lastName/derived-name from a DTO, falling back to existing
 * values on update. Prefers explicit first/last; otherwise splits `name`.
 */
function resolveName(
  dto: { firstName?: string; lastName?: string; name?: string },
  existing?: { firstName: string; lastName: string },
): { firstName: string; lastName: string; name: string } | null {
  let firstName: string | undefined;
  let lastName: string | undefined;
  if (dto.firstName !== undefined || dto.lastName !== undefined) {
    firstName = (dto.firstName ?? existing?.firstName ?? '').trim();
    lastName = (dto.lastName ?? existing?.lastName ?? '').trim();
  } else if (dto.name !== undefined) {
    const s = splitFullName(dto.name);
    firstName = s.firstName;
    lastName = s.lastName;
  } else {
    return null; // nothing name-related provided (update of other fields only)
  }
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return { firstName, lastName, name };
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
    const parts = resolveName(dto);
    if (!parts || !parts.name) throw new BadRequestException('A first name is required');
    const companyIds = await this.validCompanyIds(orgId, dto.companyIds);
    const row = await this.prisma.person.create({
      data: {
        orgId,
        firstName: parts.firstName,
        lastName: parts.lastName,
        name: parts.name,
        emails: dto.email ? [dto.email] : [],
        phones: dto.phone ? [dto.phone] : [],
        address: (dto.address ?? undefined) as Prisma.InputJsonValue | undefined,
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
    const existing = await this.get(orgId, id);

    const data: Prisma.PersonUncheckedUpdateInput = {};
    const parts = resolveName(dto, existing);
    if (parts) {
      if (!parts.name) throw new BadRequestException('A first name is required');
      data.firstName = parts.firstName;
      data.lastName = parts.lastName;
      data.name = parts.name;
    }
    if (dto.email !== undefined) data.emails = dto.email ? [dto.email] : [];
    if (dto.phone !== undefined) data.phones = dto.phone ? [dto.phone] : [];
    if (dto.address !== undefined) data.address = dto.address as Prisma.InputJsonValue;
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
