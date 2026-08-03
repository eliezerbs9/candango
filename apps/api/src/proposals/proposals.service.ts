import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../uploads/spaces.service';
import { buildTemplateContext } from '../email-templates/template-vars';
import { CreateProposalDto, UpdateProposalDto } from './dto/proposal.dto';

const shape = (p: {
  id: string;
  dealId: string;
  templateId: string | null;
  title: string;
  theme: Prisma.JsonValue;
  content: Prisma.JsonValue;
  estimateIds: string[];
  status: string;
  shareToken: string;
  feedback: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  respondedAt: Date | null;
  updatedAt: Date;
}) => ({
  id: p.id,
  dealId: p.dealId,
  templateId: p.templateId,
  title: p.title,
  theme: (p.theme ?? {}) as Record<string, unknown>,
  content: (p.content ?? []) as unknown[],
  estimateIds: p.estimateIds,
  status: p.status,
  shareToken: p.shareToken,
  feedback: p.feedback,
  sentAt: p.sentAt?.toISOString() ?? null,
  viewedAt: p.viewedAt?.toISOString() ?? null,
  respondedAt: p.respondedAt?.toISOString() ?? null,
  updatedAt: p.updatedAt.toISOString(),
});

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: SpacesService,
    private readonly events: EventEmitter2,
  ) {}

  async list(orgId: string, dealId: string) {
    const rows = await this.prisma.proposal.findMany({ where: { orgId, dealId }, orderBy: { createdAt: 'desc' } });
    return rows.map(shape);
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.proposal.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Proposal not found');
    return shape(row);
  }

  async create(orgId: string, userId: string, dto: CreateProposalDto) {
    const deal = await this.prisma.deal.findFirst({ where: { id: dto.dealId, orgId }, select: { title: true } });
    if (!deal) throw new BadRequestException('Deal not found');
    const template = dto.templateId
      ? await this.prisma.proposalTemplate.findFirst({ where: { id: dto.templateId, orgId, archivedAt: null } })
      : null;
    const row = await this.prisma.proposal.create({
      data: {
        orgId,
        dealId: dto.dealId,
        templateId: template?.id ?? null,
        createdByUserId: userId,
        title: dto.title?.trim() || deal.title,
        theme: (template?.theme ?? {}) as Prisma.InputJsonValue,
        content: (template?.layout ?? []) as Prisma.InputJsonValue, // start from the template's layout
        estimateIds: dto.estimateIds ?? [],
      },
    });
    return shape(row);
  }

  async update(orgId: string, id: string, dto: UpdateProposalDto) {
    await this.get(orgId, id);
    const row = await this.prisma.proposal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.estimateIds !== undefined ? { estimateIds: dto.estimateIds } : {}),
        ...(dto.content !== undefined ? { content: dto.content as Prisma.InputJsonValue } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as Prisma.InputJsonValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return shape(row);
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.proposal.delete({ where: { id } });
  }

  /**
   * The render payload for a proposal: resolved {{variable}} values, image/document custom-field
   * values as signed URLs (keyed by field key), and the pricing rows from the selected estimates.
   * The web renderer combines this with the layout (content) to draw the proposal.
   */
  async render(orgId: string, id: string) {
    const proposal = await this.prisma.proposal.findFirst({ where: { id, orgId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return { ...shape(proposal), ...(await this.renderData(orgId, proposal.dealId, proposal.estimateIds)) };
  }

  /** Shared render-data builder (also used by the public page). */
  async renderData(orgId: string, dealId: string, estimateIds: string[]) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: {
        title: true,
        value: true,
        currency: true,
        customFields: true,
        ownerUserId: true,
        primaryPerson: { select: { firstName: true, lastName: true, name: true, emails: true, phones: true } },
        company: { select: { name: true } },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const [owner, org, fieldDefs] = await Promise.all([
      deal.ownerUserId
        ? this.prisma.user.findFirst({ where: { id: deal.ownerUserId, orgId }, select: { name: true, email: true, phone: true } })
        : null,
      this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, timezone: true, logoUrl: true } }),
      this.prisma.customFieldDefinition.findMany({
        where: { orgId, entity: 'deal', type: { in: ['image', 'document'] } },
        select: { key: true, type: true },
      }),
    ]);

    const variables = buildTemplateContext({
      person: deal.primaryPerson,
      company: deal.company,
      deal: { title: deal.title, value: deal.value, currency: deal.currency },
      sender: owner,
      workspace: org,
    });

    // Resolve image/document custom-field files to signed URLs (only if storage is configured).
    // Files carry their stable object `key` (so a manual pick in a proposal survives re-render, when
    // the signed `url` has rotated) alongside a fresh signed `url`. Kept oldest→newest (upload order).
    const cf = (deal.customFields ?? {}) as Record<string, unknown>;
    const imagesByField: Record<string, { key: string; url: string }[]> = {};
    const documentsByField: Record<string, { key: string; name: string; url: string }[]> = {};
    if (this.spaces.configured) {
      for (const def of fieldDefs) {
        const raw = cf[def.key];
        if (def.type === 'image' && Array.isArray(raw)) {
          imagesByField[def.key] = await Promise.all(
            (raw as string[])
              .filter((k) => typeof k === 'string')
              .map(async (k) => ({ key: k, url: await this.spaces.presignGet(k) })),
          );
        } else if (def.type === 'document' && Array.isArray(raw)) {
          documentsByField[def.key] = await Promise.all(
            (raw as { name?: string; key?: string }[])
              .filter((d) => d && typeof d.key === 'string')
              .map(async (d) => ({ key: d.key as string, name: d.name ?? 'Document', url: await this.spaces.presignGet(d.key as string) })),
          );
        }
      }
    }

    // Pricing from the selected estimates.
    const estimates = estimateIds.length
      ? await this.prisma.dealEstimate.findMany({
          where: { id: { in: estimateIds }, orgId, dealId, deletedAt: null },
          select: {
            currency: true,
            totalAmount: true,
            lines: { orderBy: { position: 'asc' }, select: { description: true, amount: true } },
          },
        })
      : [];
    const pricing = {
      currency: estimates[0]?.currency ?? deal.currency,
      rows: estimates.flatMap((e) => e.lines.map((l) => ({ description: l.description, amount: l.amount }))),
      total: estimates.reduce((sum, e) => sum + e.totalAmount, 0),
    };

    return { variables, imagesByField, documentsByField, logoUrl: org?.logoUrl ?? null, pricing };
  }

  /** Available estimates for a deal (for the "select estimates" picker). */
  async dealEstimates(orgId: string, dealId: string) {
    const rows = await this.prisma.dealEstimate.findMany({
      where: { orgId, dealId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, docNumber: true, status: true, totalAmount: true, currency: true },
    });
    return rows.map((r) => ({
      id: r.id,
      docNumber: r.docNumber,
      status: r.status,
      total: r.totalAmount,
      currency: r.currency,
    }));
  }
}
