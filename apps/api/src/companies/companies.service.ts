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
  address: Prisma.JsonValue;
  phone: string | null;
  tags: string[];
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
    tags: c.tags ?? [],
    customFields: (c.customFields as Record<string, unknown>) ?? {},
    contacts: c.contacts.map((l) => l.person),
  };
}

const cleanTags = (tags?: string[]) =>
  tags ? [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 30) : undefined;

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
        address: (dto.address ?? undefined) as Prisma.InputJsonValue | undefined,
        phone: dto.phone ?? null,
        tags: cleanTags(dto.tags) ?? [],
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

  /** Full profile for the company detail view: core fields + contacts + deals + recent messages. */
  async detail(orgId: string, id: string) {
    const company = await this.get(orgId, id);
    const [deals, messages] = await Promise.all([
      this.prisma.deal.findMany({
        where: { orgId, deletedAt: null, companyId: id },
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
        where: { orgId, deal: { companyId: id } },
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
    return {
      ...company,
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

  async update(orgId: string, id: string, dto: UpdateCompanyDto) {
    await this.get(orgId, id);

    const data: Prisma.CompanyUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.domain !== undefined) data.domain = dto.domain;
    if (dto.address !== undefined) data.address = dto.address as Prisma.InputJsonValue;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.tags !== undefined) data.tags = cleanTags(dto.tags);
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
