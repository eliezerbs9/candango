import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../uploads/spaces.service';
import { MessagesService } from '../messages/messages.service';
import { buildTemplateContext, renderTemplate } from '../email-templates/template-vars';
import { CreateProposalDto, SendProposalDto, UpdateProposalDto } from './dto/proposal.dto';

/** Walk a proposal's layout (pages → elements) and collect object keys of "fixed" image/document files. */
function collectFixedFileKeys(content: unknown): string[] {
  const keys: string[] = [];
  const pages = Array.isArray(content) ? content : [];
  for (const page of pages) {
    const elements = (page as { elements?: unknown })?.elements;
    if (!Array.isArray(elements)) continue;
    for (const el of elements) {
      const props = (el as { props?: Record<string, unknown> })?.props;
      if (!props || props.source !== 'fixed' || !Array.isArray(props.files)) continue;
      for (const f of props.files as { key?: unknown }[]) {
        if (f && typeof f.key === 'string') keys.push(f.key);
      }
    }
  }
  return keys;
}

export const shapeProposal = (p: {
  id: string;
  dealId: string;
  templateId: string | null;
  emailTemplateId: string | null;
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
  emailTemplateId: p.emailTemplateId,
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
    private readonly messages: MessagesService,
    private readonly config: ConfigService,
  ) {}

  /** The public presentation link for a proposal's share token. */
  private shareLink(shareToken: string) {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    return `${appUrl}/proposal/${encodeURIComponent(shareToken)}`;
  }

  /**
   * Mark a proposal sent and (best-effort) email the presentation link to the recipient. The link is
   * returned regardless, so it works for testing even when the sender's mailbox isn't connected.
   */
  async send(orgId: string, userId: string, id: string, dto: SendProposalDto) {
    const proposal = await this.prisma.proposal.findFirst({ where: { id, orgId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    const link = this.shareLink(proposal.shareToken);

    const deal = await this.prisma.deal.findFirst({
      where: { id: proposal.dealId, orgId },
      select: {
        title: true,
        value: true,
        currency: true,
        ownerUserId: true,
        primaryPerson: { select: { name: true, firstName: true, lastName: true, emails: true, phones: true } },
        company: { select: { name: true } },
      },
    });
    const firstEmail = (() => {
      const raw = deal?.primaryPerson?.emails;
      if (Array.isArray(raw) && raw.length) {
        const first = raw[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object' && typeof (first as { value?: string }).value === 'string') return (first as { value: string }).value;
      }
      return undefined;
    })();
    const to = (dto.to && dto.to.length ? dto.to : firstEmail ? [firstEmail] : []).filter(Boolean);

    // Build subject/body from the proposal's email template (falls back to a default message).
    const name = deal?.primaryPerson?.firstName || deal?.primaryPerson?.name || 'there';
    let subject = `Proposal: ${proposal.title}`;
    let body =
      `<p>Hi ${name},</p>` +
      `<p>Your proposal <strong>${proposal.title}</strong> is ready. You can review it here:</p>` +
      `<p><a href="${link}">View your proposal</a></p>`;

    if (proposal.emailTemplateId) {
      const et = await this.prisma.emailTemplate.findFirst({ where: { id: proposal.emailTemplateId, orgId, archivedAt: null } });
      if (et) {
        const [owner, org] = await Promise.all([
          deal?.ownerUserId ? this.prisma.user.findFirst({ where: { id: deal.ownerUserId, orgId }, select: { name: true, email: true, phone: true } }) : null,
          this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, timezone: true } }),
        ]);
        const ctx = buildTemplateContext({
          person: deal?.primaryPerson,
          company: deal?.company,
          deal: deal ? { title: deal.title, value: deal.value, currency: deal.currency } : null,
          sender: owner,
          workspace: org,
        });
        ctx['proposal.link'] = link;
        subject = renderTemplate(et.subject, ctx) || subject;
        body = renderTemplate(et.body, ctx);
        // Always ensure the link is present, even if the template didn't reference {{proposal.link}}.
        if (!et.body.includes('proposal.link')) body += `<p><a href="${link}">View your proposal</a></p>`;
      }
    }

    let emailed = false;
    if (to.length) {
      try {
        await this.messages.send(orgId, userId, { to, subject, body, html: true, dealId: proposal.dealId });
        emailed = true;
      } catch {
        // Mailbox not connected / send failed — the link is still returned so it can be shared manually.
      }
    }

    const row = await this.prisma.proposal.update({
      where: { id },
      data: { status: proposal.status === 'draft' ? 'sent' : proposal.status, sentAt: proposal.sentAt ?? new Date() },
    });
    return { ...shapeProposal(row), link, emailed };
  }

  async list(orgId: string, dealId: string) {
    const rows = await this.prisma.proposal.findMany({ where: { orgId, dealId }, orderBy: { createdAt: 'desc' } });
    // Sum each proposal's selected estimates so the list can show a value.
    const ids = [...new Set(rows.flatMap((r) => r.estimateIds))];
    const estimates = ids.length
      ? await this.prisma.dealEstimate.findMany({ where: { id: { in: ids }, orgId, dealId, deletedAt: null }, select: { id: true, totalAmount: true, currency: true } })
      : [];
    const byId = new Map(estimates.map((e) => [e.id, e]));
    return rows.map((r) => {
      const sel = r.estimateIds.map((id) => byId.get(id)).filter((e): e is (typeof estimates)[number] => !!e);
      return { ...shapeProposal(r), total: sel.reduce((s, e) => s + e.totalAmount, 0), currency: sel[0]?.currency ?? 'USD' };
    });
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.proposal.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Proposal not found');
    return shapeProposal(row);
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
        emailTemplateId: template?.emailTemplateId ?? null,
        createdByUserId: userId,
        title: dto.title?.trim() || deal.title,
        theme: (template?.theme ?? {}) as Prisma.InputJsonValue,
        content: (template?.layout ?? []) as Prisma.InputJsonValue, // start from the template's layout
        estimateIds: dto.estimateIds ?? [],
      },
    });
    return shapeProposal(row);
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
    return shapeProposal(row);
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
    return {
      ...shapeProposal(proposal),
      ...(await this.renderData(orgId, proposal.dealId, proposal.estimateIds, proposal.content)),
    };
  }

  /** Render data for a chosen deal (all its estimates), to preview a template against real data. */
  async previewData(orgId: string, dealId: string) {
    const estimates = await this.prisma.dealEstimate.findMany({ where: { orgId, dealId, deletedAt: null }, select: { id: true } });
    return this.renderData(orgId, dealId, estimates.map((e) => e.id));
  }

  /** Shared render-data builder (also used by the public page). */
  async renderData(orgId: string, dealId: string, estimateIds: string[], content?: Prisma.JsonValue) {
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

    // Template-owned "fixed" files embedded in the layout → signed URLs (org-scoped keys only).
    const fixedFilesByKey: Record<string, string> = {};
    if (this.spaces.configured) {
      const keys = collectFixedFileKeys(content).filter((k) => k.startsWith(`org-${orgId}/`));
      await Promise.all(keys.map(async (k) => { fixedFilesByKey[k] = await this.spaces.presignGet(k); }));
    }

    return { variables, imagesByField, documentsByField, logoUrl: org?.logoUrl ?? null, fixedFilesByKey, pricing };
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
