import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DealEventsService } from '../deal-events/deal-events.service';
import { SpacesService } from '../uploads/spaces.service';
import { MessagesService } from '../messages/messages.service';
import { buildSignatureValues, buildTemplateContext, normalizeSignature, renderSignatureHtml, renderTemplate } from '../email-templates/template-vars';
import { CreateProposalDto, SendProposalDto, UpdateProposalDto } from './dto/proposal.dto';
import { collectProposalPricingIds, normalizeProposalFields, proposalSendBlockers } from './proposal-fields';
import { DealValueService } from '../deals/deal-value.service';

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

/** Collect estimate/invoice ids referenced by pricing elements' per-element `docs` array. */
export function collectPricingDocs(content: unknown): { estimateIds: string[]; invoiceIds: string[] } {
  const estimateIds: string[] = [];
  const invoiceIds: string[] = [];
  const pages = Array.isArray(content) ? content : [];
  for (const page of pages) {
    const elements = (page as { elements?: unknown })?.elements;
    if (!Array.isArray(elements)) continue;
    for (const el of elements) {
      const e = el as { type?: string; props?: Record<string, unknown> };
      if (e?.type !== 'pricing' || !Array.isArray(e.props?.docs)) continue;
      for (const d of e.props!.docs as { kind?: unknown; id?: unknown }[]) {
        if (!d || typeof d.id !== 'string') continue;
        if (d.kind === 'invoice') invoiceIds.push(d.id);
        else estimateIds.push(d.id);
      }
    }
  }
  return { estimateIds, invoiceIds };
}

export const shapeProposal = (p: {
  id: string;
  dealId: string;
  templateId: string | null;
  emailTemplateId: string | null;
  title: string;
  theme: Prisma.JsonValue;
  content: Prisma.JsonValue;
  fields: Prisma.JsonValue;
  fieldValues: Prisma.JsonValue;
  estimateIds: string[];
  status: string;
  shareToken: string;
  feedback: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: p.id,
  dealId: p.dealId,
  templateId: p.templateId,
  emailTemplateId: p.emailTemplateId,
  title: p.title,
  theme: (p.theme ?? {}) as Record<string, unknown>,
  content: (p.content ?? []) as unknown[],
  fields: normalizeProposalFields(p.fields),
  fieldValues: (p.fieldValues ?? {}) as Record<string, unknown>,
  estimateIds: p.estimateIds,
  status: p.status,
  shareToken: p.shareToken,
  feedback: p.feedback,
  sentAt: p.sentAt?.toISOString() ?? null,
  viewedAt: p.viewedAt?.toISOString() ?? null,
  respondedAt: p.respondedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
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
    private readonly dealValue: DealValueService,
    private readonly dealEvents: DealEventsService,
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

    // Gate on internal fields before sending: required fields filled, and single-limit fields not over one.
    // document/image resolve from the bound deal custom field; estimate/invoice from the union below.
    const gateDeal = await this.prisma.deal.findFirst({ where: { id: proposal.dealId, orgId }, select: { customFields: true } });
    const pFields = normalizeProposalFields(proposal.fields);
    const pFieldValues = (proposal.fieldValues ?? {}) as Record<string, unknown>;
    // Every estimate/invoice the proposal references: pricing elements ∪ estimate/invoice fields ∪ legacy.
    const linkedPricing = collectProposalPricingIds(pFields, pFieldValues, collectPricingDocs(proposal.content), proposal.estimateIds);
    const blockers = proposalSendBlockers(pFields, {
      fieldValues: pFieldValues,
      dealCustomFields: (gateDeal?.customFields ?? {}) as Record<string, unknown>,
      estimateIds: linkedPricing.estimateIds,
      invoiceIds: linkedPricing.invoiceIds,
    });
    if (blockers.length) {
      throw new BadRequestException(blockers.join('; '));
    }

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

    const [owner, org] = await Promise.all([
      deal?.ownerUserId ? this.prisma.user.findFirst({ where: { id: deal.ownerUserId, orgId }, select: { name: true, email: true, phone: true, avatarUrl: true } }) : null,
      this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true, timezone: true, logoUrl: true, emailSignature: true } }),
    ]);

    // One proposal-scoped email template covers all proposals (configured in Settings → Proposals).
    const et = await this.prisma.emailTemplate.findFirst({ where: { orgId, scope: 'proposal', archivedAt: null }, orderBy: { createdAt: 'asc' } });
    if (et) {
      const ctx = buildTemplateContext({
        person: deal?.primaryPerson,
        company: deal?.company,
        deal: deal ? { title: deal.title, value: deal.value, currency: deal.currency } : null,
        sender: owner,
        workspace: org,
      });
      // {{proposal.url}} renders as a "View your proposal" link; {{proposal.name}} is the title.
      ctx['proposal.url'] = `<a href="${link}">View your proposal</a>`;
      ctx['proposal.name'] = proposal.title;
      subject = renderTemplate(et.subject, ctx) || subject;
      body = renderTemplate(et.body, ctx);
      if (!et.body.includes('proposal.url')) body += `<p><a href="${link}">View your proposal</a></p>`;
    }

    // Append the resolved workspace signature (same one used elsewhere).
    const signature = renderSignatureHtml(
      normalizeSignature(org?.emailSignature),
      buildSignatureValues(
        { name: owner?.name, email: owner?.email, phone: owner?.phone, avatarUrl: owner?.avatarUrl },
        { name: org?.name, logoUrl: org?.logoUrl },
      ),
    );
    if (signature.trim()) body += signature;

    let emailed = false;
    if (to.length) {
      try {
        await this.messages.send(orgId, userId, { to, subject, body, html: true, dealId: proposal.dealId });
        emailed = true;
      } catch {
        // Mailbox not connected / send failed — the link is still returned so it can be shared manually.
      }
    }

    const wasDraft = proposal.status === 'draft';
    const row = await this.prisma.proposal.update({
      where: { id },
      data: { status: wasDraft ? 'sent' : proposal.status, sentAt: proposal.sentAt ?? new Date() },
    });

    // Sending the proposal also sends its estimates: flip every linked draft estimate to `sent`.
    if (wasDraft && linkedPricing.estimateIds.length) {
      await this.prisma.dealEstimate.updateMany({
        where: { id: { in: linkedPricing.estimateIds }, orgId, deletedAt: null, status: 'draft' },
        data: { status: 'sent' },
      });
      await this.dealValue.recompute(orgId, proposal.dealId); // estimate status changed → deal value
    }
    return { ...shapeProposal(row), link, emailed };
  }

  async list(orgId: string, dealId: string) {
    const rows = await this.prisma.proposal.findMany({ where: { orgId, dealId }, orderBy: { createdAt: 'desc' } });
    // Each proposal's estimates come from its pricing elements ∪ estimate fields ∪ legacy estimateIds.
    const idsByRow = rows.map((r) =>
      collectProposalPricingIds(normalizeProposalFields(r.fields), (r.fieldValues ?? {}) as Record<string, unknown>, collectPricingDocs(r.content), r.estimateIds)
        .estimateIds,
    );
    const ids = [...new Set(idsByRow.flat())];
    const estimates = ids.length
      ? await this.prisma.dealEstimate.findMany({ where: { id: { in: ids }, orgId, dealId, deletedAt: null }, select: { id: true, totalAmount: true, currency: true } })
      : [];
    const byId = new Map(estimates.map((e) => [e.id, e]));
    return rows.map((r, i) => {
      const sel = idsByRow[i].map((id) => byId.get(id)).filter((e): e is (typeof estimates)[number] => !!e);
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
        // Snapshot the template's internal (client-hidden) field defs so later template edits don't retro-break this proposal.
        fields: normalizeProposalFields(template?.fields) as unknown as Prisma.InputJsonValue,
        estimateIds: dto.estimateIds ?? [],
      },
    });
    return shapeProposal(row);
  }

  async update(orgId: string, id: string, dto: UpdateProposalDto, userId?: string) {
    const current = await this.get(orgId, id);
    const statusChanged = dto.status !== undefined && dto.status !== current.status;
    const decision = statusChanged && ['accepted', 'denied', 'deferred'].includes(dto.status!) ? (dto.status as 'accepted' | 'denied' | 'deferred') : null;
    const feedback = dto.feedback?.trim() || null;
    // The user must give a reason when marking a proposal declined or deferred (mirrors the client flow).
    if ((decision === 'denied' || decision === 'deferred') && !feedback) {
      throw new BadRequestException('Add a reason when declining or deferring a proposal.');
    }

    const row = await this.prisma.proposal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.estimateIds !== undefined ? { estimateIds: dto.estimateIds } : {}),
        ...(dto.content !== undefined ? { content: dto.content as Prisma.InputJsonValue } : {}),
        ...(dto.fieldValues !== undefined ? { fieldValues: dto.fieldValues as Prisma.InputJsonValue } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as Prisma.InputJsonValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(decision ? { feedback, respondedAt: new Date() } : {}),
      },
    });

    if (decision) {
      // Roll the decision onto every linked estimate's internal status (our DB only — accepted→accepted,
      // denied→rejected). Estimates come from the union (pricing elements ∪ estimate fields ∪ legacy).
      const estStatus = decision === 'accepted' ? 'accepted' : decision === 'denied' ? 'rejected' : null;
      if (estStatus) {
        const linked = collectProposalPricingIds(current.fields, current.fieldValues, collectPricingDocs(current.content), current.estimateIds);
        if (linked.estimateIds.length) {
          await this.prisma.dealEstimate.updateMany({
            where: { id: { in: linked.estimateIds }, orgId, deletedAt: null, status: { notIn: ['closed'] } },
            data: { status: estStatus },
          });
        }
        await this.dealValue.recompute(orgId, current.dealId); // estimate status changed → deal value
      }
      // Log the outcome on the deal timeline, attributed to the team member who marked it.
      const verb = decision === 'accepted' ? 'accepted' : decision === 'denied' ? 'declined' : 'deferred';
      const user = userId ? await this.prisma.user.findFirst({ where: { id: userId, orgId }, select: { name: true, email: true } }) : null;
      const actor = user ? user.name || user.email : 'A team member';
      await this.dealEvents.log(orgId, current.dealId, {
        kind: 'proposal',
        title: `Proposal “${current.title}” ${verb}`,
        body: feedback ? `Reason: ${feedback}` : null,
        actor,
      });
      // Fire the automation/webhook event (accepted / declined / deferred).
      const type = decision === 'accepted' ? 'proposal.accepted' : decision === 'denied' ? 'proposal.declined' : 'proposal.deferred';
      this.events.emit('webhook.event', { orgId, type, data: { deal: { id: current.dealId }, proposal: { id } } });
    }
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

    // Per-element pricing: resolve every estimate/invoice a pricing element references via `props.docs`,
    // keyed by document id, so each pricing element can show its own table (falling back to the
    // proposal-level aggregate `pricing` above when an element has no `docs`).
    const lineSel = { orderBy: { position: 'asc' as const }, select: { description: true, amount: true } };
    const perDoc = collectPricingDocs(content);
    const pricingByDoc: Record<string, { currency: string; rows: { description: string; amount: number }[]; total: number }> = {};
    const [estDocs, invDocs] = await Promise.all([
      perDoc.estimateIds.length
        ? this.prisma.dealEstimate.findMany({
            where: { id: { in: perDoc.estimateIds }, orgId, dealId, deletedAt: null },
            select: { id: true, currency: true, totalAmount: true, lines: lineSel },
          })
        : [],
      perDoc.invoiceIds.length
        ? this.prisma.dealInvoice.findMany({
            where: { id: { in: perDoc.invoiceIds }, orgId, dealId, deletedAt: null },
            select: { id: true, currency: true, totalAmount: true, lines: lineSel },
          })
        : [],
    ]);
    for (const d of [...estDocs, ...invDocs]) {
      pricingByDoc[d.id] = {
        currency: d.currency,
        rows: d.lines.map((l) => ({ description: l.description, amount: l.amount })),
        total: d.totalAmount,
      };
    }

    // Template-owned "fixed" files embedded in the layout → signed URLs (org-scoped keys only).
    const fixedFilesByKey: Record<string, string> = {};
    if (this.spaces.configured) {
      const keys = collectFixedFileKeys(content).filter((k) => k.startsWith(`org-${orgId}/`));
      await Promise.all(keys.map(async (k) => { fixedFilesByKey[k] = await this.spaces.presignGet(k); }));
    }

    return { variables, imagesByField, documentsByField, logoUrl: org?.logoUrl ?? null, fixedFilesByKey, pricing, pricingByDoc };
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
