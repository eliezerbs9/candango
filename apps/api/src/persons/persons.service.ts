import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person.dto';
import { formatPersonName } from './name-format';

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
  tags: string[];
  emailSubscribed: boolean;
  emailUnsubscribedAt: Date | null;
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
    tags: p.tags ?? [],
    emailSubscribed: p.emailSubscribed,
    emailUnsubscribedAt: p.emailUnsubscribedAt?.toISOString() ?? null,
    customFields: (p.customFields as Record<string, unknown>) ?? {},
    companies: p.companyLinks.map((l) => l.company),
  };
}

const cleanTags = (tags?: string[]) =>
  tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 30) : undefined;

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

  /** The workspace's chosen contact-name display format (drives the derived Person.name). */
  private async nameFormat(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findFirst({ where: { id: orgId }, select: { qboNameFormat: true } });
    return org?.qboNameFormat ?? 'first_last';
  }

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
    const name = formatPersonName(parts.firstName, parts.lastName, await this.nameFormat(orgId));
    const companyIds = await this.validCompanyIds(orgId, dto.companyIds);
    const row = await this.prisma.person.create({
      data: {
        orgId,
        firstName: parts.firstName,
        lastName: parts.lastName,
        name,
        emails: dto.email ? [dto.email] : [],
        phones: dto.phone ? [dto.phone] : [],
        address: (dto.address ?? undefined) as Prisma.InputJsonValue | undefined,
        tags: cleanTags(dto.tags) ?? [],
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

  /** Full profile for the person detail view: core fields + their deals + recent messages. */
  async detail(orgId: string, id: string) {
    const person = await this.get(orgId, id);
    const [deals, messages] = await Promise.all([
      this.prisma.deal.findMany({
        where: { orgId, deletedAt: null, OR: [{ primaryPersonId: id }, { participants: { some: { personId: id } } }] },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          refNumber: true,
          title: true,
          value: true,
          currency: true,
          status: true,
          stage: { select: { name: true } },
        },
      }),
      this.prisma.message.findMany({
        where: { orgId, personId: id },
        orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          direction: true,
          subject: true,
          snippet: true,
          fromAddress: true,
          sentAt: true,
          createdAt: true,
          dealId: true,
        },
      }),
    ]);
    const documents = await this.documentsForDeals(
      orgId,
      deals.map((d) => ({ id: d.id, title: d.title })),
    );
    const qbLink = await this.prisma.quickBooksCustomerLink.findFirst({
      where: { orgId, clientType: 'person', clientId: id },
      select: { qbCustomerId: true },
    });
    return {
      ...person,
      qbCustomerId: qbLink?.qbCustomerId ?? null,
      deals: deals.map((d) => ({
        id: d.id,
        refNumber: d.refNumber,
        title: d.title,
        value: d.value,
        currency: d.currency,
        status: d.status,
        stageName: d.stage?.name ?? null,
      })),
      documents,
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        subject: m.subject,
        snippet: m.snippet,
        fromAddress: m.fromAddress,
        at: (m.sentAt ?? m.createdAt).toISOString(),
        dealId: m.dealId,
      })),
    };
  }

  /** Estimates + invoices across a set of deals, newest first — for the contact detail views. */
  private async documentsForDeals(orgId: string, deals: { id: string; title: string }[]) {
    const dealIds = deals.map((d) => d.id);
    if (dealIds.length === 0) return [];
    const titleById = new Map(deals.map((d) => [d.id, d.title]));
    const select = {
      id: true,
      docNumber: true,
      status: true,
      totalAmount: true,
      currency: true,
      txnDate: true,
      createdAt: true,
      dealId: true,
    } as const;
    const [estimates, invoices] = await Promise.all([
      this.prisma.dealEstimate.findMany({ where: { orgId, dealId: { in: dealIds }, deletedAt: null }, select }),
      this.prisma.dealInvoice.findMany({ where: { orgId, dealId: { in: dealIds }, deletedAt: null }, select }),
    ]);
    const rows = [
      ...estimates.map((e) => ({ ...e, kind: 'estimate' as const })),
      ...invoices.map((i) => ({ ...i, kind: 'invoice' as const })),
    ];
    return rows
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        docNumber: r.docNumber,
        status: r.status,
        total: r.totalAmount,
        currency: r.currency,
        at: (r.txnDate ?? r.createdAt).toISOString(),
        dealId: r.dealId,
        dealTitle: titleById.get(r.dealId) ?? null,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  async update(orgId: string, id: string, dto: UpdatePersonDto) {
    const existing = await this.get(orgId, id);

    const data: Prisma.PersonUncheckedUpdateInput = {};
    const parts = resolveName(dto, existing);
    if (parts) {
      if (!parts.name) throw new BadRequestException('A first name is required');
      data.firstName = parts.firstName;
      data.lastName = parts.lastName;
      data.name = formatPersonName(parts.firstName, parts.lastName, await this.nameFormat(orgId));
    }
    if (dto.email !== undefined) data.emails = dto.email ? [dto.email] : [];
    if (dto.phone !== undefined) data.phones = dto.phone ? [dto.phone] : [];
    if (dto.address !== undefined) data.address = dto.address as Prisma.InputJsonValue;
    if (dto.tags !== undefined) data.tags = cleanTags(dto.tags);
    if (dto.emailSubscribed !== undefined) {
      data.emailSubscribed = dto.emailSubscribed;
      // Re-subscribing clears the opt-out stamp; opting out sets it.
      data.emailUnsubscribedAt = dto.emailSubscribed ? null : new Date();
    }
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
