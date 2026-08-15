import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { QuickbooksApiService, type DocInput, type NormalizedDoc } from '../../integrations/quickbooks-api.service';
import { DealValueService } from '../deal-value.service';
import { ConvertToInvoiceDto, CreateDocDto, LinkQuickbooksDto } from './dto/quickbooks.dto';

// our estimate status <-> QBO TxnStatus
const TO_TXN_STATUS: Record<string, string> = { accepted: 'Accepted', rejected: 'Rejected', closed: 'Closed', sent: 'Pending', draft: 'Pending' };
// QBO has no "sent"/"draft" TxnStatus (both are "Pending"); a freshly created QBO estimate is Pending → draft.
const FROM_TXN_STATUS: Record<string, string> = { Accepted: 'accepted', Rejected: 'rejected', Closed: 'closed', Pending: 'draft' };

const lineSelect = { orderBy: { position: 'asc' as const } };
type Addr = Record<string, string> | null;
type DealForQbo = { id: string; refNumber: number | null; qbSubcustomerId: string | null; currency: string; shipTo: unknown; billTo: unknown };

function dealPrivateNote(deal: DealForQbo) {
  // Internal note (QBO PrivateNote) — the readable deal ref only; no raw cuid in the memo.
  return `Candango deal #${deal.refNumber ?? '?'}`;
}

/** Build a person's QuickBooks customer name per the org's qboNameFormat. */
function formatQboPersonName(p: { name: string; firstName: string; lastName: string }, format?: string | null): string {
  if (format === 'last_first' && p.firstName && p.lastName) return `${p.lastName}, ${p.firstName}`;
  return p.name || `${p.firstName} ${p.lastName}`.trim();
}

@Injectable()
export class DealQuickbooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qbo: QuickbooksApiService,
    private readonly events: EventEmitter2,
    private readonly dealValue: DealValueService,
  ) {}

  private async requireDeal(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId, deletedAt: null },
      include: {
        company: { select: { name: true } },
        primaryPerson: { select: { name: true, firstName: true, lastName: true } },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  private async requireLinked(orgId: string, dealId: string) {
    const deal = await this.requireDeal(orgId, dealId);
    if (!deal.qbSubcustomerId) {
      throw new BadRequestException('Link this deal to a QuickBooks account first');
    }
    return deal;
  }

  private async isConnected(orgId: string) {
    const conn = await this.prisma.quickBooksConnection.findUnique({ where: { orgId }, select: { status: true } });
    return conn?.status === 'connected';
  }

  /**
   * QuickBooks-sourced documents become READ-ONLY while QuickBooks is disconnected — we keep the
   * data, but the user can't create/edit/send them until they reconnect. Native docs are unaffected.
   */
  private async requireQboWritable(orgId: string, source: string) {
    if (source === 'quickbooks' && !(await this.isConnected(orgId))) {
      throw new BadRequestException('Reconnect QuickBooks to edit estimates and invoices synced with it');
    }
  }

  /** Build the QBO doc payload from a linked deal + the request DTO. */
  private qboDocInput(deal: DealForQbo, dto: CreateDocDto): DocInput {
    return {
      customerId: deal.qbSubcustomerId!,
      currency: deal.currency,
      txnDate: dto.txnDate,
      lines: dto.lines,
      billAddr: deal.billTo as Addr,
      shipAddr: deal.shipTo as Addr,
      privateNote: dealPrivateNote(deal),
      memo: dto.notes ?? undefined,
    };
  }

  // --- Account linking ---
  async link(orgId: string, dealId: string, dto: LinkQuickbooksDto) {
    const deal = await this.requireDeal(orgId, dealId);
    const clientType = deal.companyId ? 'company' : deal.primaryPersonId ? 'person' : null;
    const clientId = deal.companyId ?? deal.primaryPersonId ?? null;
    // A person's QuickBooks customer name follows the org's qboNameFormat (First Last | Last, First).
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { qboNameFormat: true } });
    const personName = deal.primaryPerson ? formatQboPersonName(deal.primaryPerson, org?.qboNameFormat) : null;
    const clientName = deal.company?.name ?? personName ?? deal.title;

    // Resolve the parent Customer: explicit id → existing link (client already in QBO) → create from the client.
    let parentCustomerId = dto.parentCustomerId ?? null;
    if (!parentCustomerId) {
      if (!clientType || !clientId) {
        throw new BadRequestException(
          'Add a company or primary contact to the deal, or pick an existing QuickBooks customer to bill under',
        );
      }
      const existing = await this.prisma.quickBooksCustomerLink.findFirst({ where: { orgId, clientType, clientId } });
      if (existing) parentCustomerId = existing.qbCustomerId;
      else if (dto.createParent !== false) parentCustomerId = (await this.qbo.createCustomer(orgId, clientName)).id;
      else throw new BadRequestException('Choose an existing QuickBooks customer or allow creating one');
    }

    // Remember the client → parent mapping so other deals of the same client reuse it.
    if (clientType && clientId) {
      await this.prisma.quickBooksCustomerLink.upsert({
        where: { orgId_clientType_clientId: { orgId, clientType, clientId } },
        create: { orgId, clientType, clientId, qbCustomerId: parentCustomerId },
        update: { qbCustomerId: parentCustomerId },
      });
    }

    const sub = await this.qbo.createSubCustomer(orgId, {
      displayName: deal.title,
      parentCustomerId,
      shipAddr: deal.shipTo as Addr,
      billAddr: deal.billTo as Addr,
    });
    await this.prisma.deal.update({ where: { id: dealId }, data: { qbSubcustomerId: sub.id } });
    this.events.emit('webhook.event', {
      orgId,
      type: 'quickbooks.customer_created',
      data: { dealId, qbSubcustomerId: sub.id, parentCustomerId },
    });
    return { qbSubcustomerId: sub.id, parentCustomerId };
  }

  async searchParents(orgId: string, dealId: string, q: string) {
    await this.requireDeal(orgId, dealId);
    return this.qbo.searchCustomers(orgId, q);
  }

  /** Tells the UI whether this deal (or its client) is already connected to QuickBooks. */
  async linkStatus(orgId: string, dealId: string) {
    const deal = await this.requireDeal(orgId, dealId);
    const clientType = deal.companyId ? 'company' : deal.primaryPersonId ? 'person' : null;
    const clientId = deal.companyId ?? deal.primaryPersonId ?? null;
    let clientHasParent = false;
    if (clientType && clientId) {
      const link = await this.prisma.quickBooksCustomerLink.findFirst({ where: { orgId, clientType, clientId } });
      clientHasParent = !!link;
    }
    return {
      linked: !!deal.qbSubcustomerId,
      clientHasParent,
      clientName: deal.company?.name ?? deal.primaryPerson?.name ?? null,
    };
  }

  async listItems(orgId: string, dealId: string) {
    await this.requireDeal(orgId, dealId);
    return this.qbo.listItems(orgId);
  }

  // --- Estimates ---
  async listEstimates(orgId: string, dealId: string) {
    await this.requireDeal(orgId, dealId);
    const rows = await this.prisma.dealEstimate.findMany({
      where: { orgId, dealId, deletedAt: null },
      include: { lines: lineSelect },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(shapeDoc);
  }

  /**
   * Connected → create the estimate in QuickBooks (deal must be linked).
   * Not connected → store a native estimate locally (used to price the deal).
   */
  async createEstimate(orgId: string, dealId: string, dto: CreateDocDto) {
    // Deal value is now document-driven (status-tier); every estimate is a value document.
    // QuickBooks estimate only when connected AND the deal is linked; otherwise a NATIVE estimate
    // (fallback — so a proposal/estimate can always be created without QBO, or before linking).
    let row;
    const deal = await this.requireDeal(orgId, dealId);
    if ((await this.isConnected(orgId)) && deal.qbSubcustomerId) {
      const doc = await this.qbo.createEstimate(orgId, this.qboDocInput(deal, dto));
      row = await this.prisma.dealEstimate.create({
        data: {
          orgId,
          dealId,
          source: 'quickbooks',
          status: FROM_TXN_STATUS[doc.status ?? 'Pending'] ?? 'draft',
          docNumber: doc.docNumber,
          currency: deal.currency,
          totalAmount: doc.totalAmount,
          txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
          notes: dto.notes ?? null,
          includeInValue: true,
          qbId: doc.qbId,
          qbSyncToken: doc.syncToken,
          qbSyncedAt: new Date(),
          lines: { create: linesFromDoc(doc) },
        },
        include: { lines: lineSelect },
      });
      this.events.emit('webhook.event', { orgId, type: 'quickbooks.estimate_synced', data: { dealId, estimateId: row.id } });
    } else {
      // Native (offline) estimate — amounts computed server-side. Used with no QuickBooks OR an unlinked deal.
      row = await this.prisma.dealEstimate.create({
        data: {
          orgId,
          dealId,
          source: 'native',
          status: 'draft',
          currency: deal.currency,
          totalAmount: nativeTotal(dto),
          taxRateBps: dto.taxRateBps ?? 0,
          txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
          notes: dto.notes ?? null,
          includeInValue: true,
          lines: { create: nativeLines(dto) },
        },
        include: { lines: lineSelect },
      });
    }
    await this.recomputeDealValue(orgId, dealId);
    return shapeDoc(row);
  }

  async updateEstimate(orgId: string, dealId: string, estimateId: string, dto: CreateDocDto) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est) throw new NotFoundException('Estimate not found');
    if (est.status === 'closed') {
      throw new BadRequestException('This estimate was converted to an invoice and can no longer be edited');
    }
    await this.requireQboWritable(orgId, est.source);
    if (est.source === 'quickbooks' && est.qbId) {
      const deal = await this.requireLinked(orgId, dealId);
      const doc = await this.qbo.updateEstimate(orgId, est.qbId, this.qboDocInput(deal, dto));
      const row = await this.prisma.dealEstimate.update({
        where: { id: estimateId },
        data: {
          totalAmount: doc.totalAmount,
          docNumber: doc.docNumber,
          txnDate: dto.txnDate ? new Date(dto.txnDate) : est.txnDate,
          notes: dto.notes ?? est.notes,
          qbSyncToken: doc.syncToken,
          qbSyncedAt: new Date(),
          lines: { deleteMany: {}, create: linesFromDoc(doc) },
        },
        include: { lines: lineSelect },
      });
      await this.recomputeDealValue(orgId, dealId);
      return shapeDoc(row);
    }
    const row = await this.prisma.dealEstimate.update({
      where: { id: estimateId },
      data: {
        totalAmount: nativeTotal(dto),
        taxRateBps: dto.taxRateBps ?? 0,
        txnDate: dto.txnDate ? new Date(dto.txnDate) : est.txnDate,
        notes: dto.notes ?? est.notes,
        lines: { deleteMany: {}, create: nativeLines(dto) },
      },
      include: { lines: lineSelect },
    });
    await this.recomputeDealValue(orgId, dealId);
    return shapeDoc(row);
  }

  /**
   * Delete an estimate. Native → soft-delete locally. QuickBooks-sourced → delete it in
   * QuickBooks too (must be connected) then soft-delete. A converted (closed) estimate can't
   * be deleted — its invoice depends on it, and invoices are never deletable. Deleting the
   * last estimate leaves the deal with a manual, editable value again.
   */
  async deleteEstimate(orgId: string, dealId: string, estimateId: string) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId, deletedAt: null } });
    if (!est) throw new NotFoundException('Estimate not found');
    if (est.status === 'closed') {
      throw new BadRequestException('This estimate was converted to an invoice and can no longer be deleted');
    }
    // QuickBooks-sourced estimates can only be deleted while connected (like edit/status/send).
    await this.requireQboWritable(orgId, est.source);
    if (est.source === 'quickbooks' && est.qbId) {
      await this.qbo.deleteEstimate(orgId, est.qbId);
    }
    await this.prisma.dealEstimate.update({ where: { id: estimateId }, data: { deletedAt: new Date() } });
    await this.recomputeDealValue(orgId, dealId);
    return { ok: true };
  }

  /** Mark/unmark estimates so they count toward the deal value, then recompute. */
  async includeEstimatesInValue(orgId: string, dealId: string, estimateIds: string[], include: boolean) {
    await this.requireDeal(orgId, dealId);
    // The deal value must always be backed by ≥1 estimate while estimates exist —
    // block unmarking the last counted one (FR-13.11).
    if (!include) {
      const total = await this.prisma.dealEstimate.count({ where: { orgId, dealId, deletedAt: null } });
      if (total > 0) {
        const counted = await this.prisma.dealEstimate.findMany({
          where: { orgId, dealId, deletedAt: null, includeInValue: true, status: { notIn: ['closed', 'rejected'] } },
          select: { id: true },
        });
        const remaining = counted.filter((e) => !estimateIds.includes(e.id));
        if (remaining.length === 0) {
          throw new BadRequestException('At least one estimate must count toward the deal value');
        }
      }
    }
    await this.prisma.dealEstimate.updateMany({
      where: { id: { in: estimateIds }, orgId, dealId },
      data: { includeInValue: include },
    });
    return this.recomputeDealValue(orgId, dealId);
  }

  /** The official QuickBooks PDF for a doc (only for QBO-synced docs). */
  async docPdf(orgId: string, dealId: string, kind: 'estimate' | 'invoice', docId: string): Promise<Buffer> {
    const doc =
      kind === 'estimate'
        ? await this.prisma.dealEstimate.findFirst({ where: { id: docId, orgId, dealId } })
        : await this.prisma.dealInvoice.findFirst({ where: { id: docId, orgId, dealId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!doc.qbId) throw new BadRequestException('This document is not in QuickBooks');
    return this.qbo.getDocPdf(orgId, kind, doc.qbId);
  }

  /** Mark/unmark invoices for the deal value (default included), then recompute. */
  async includeInvoicesInValue(orgId: string, dealId: string, invoiceIds: string[], include: boolean) {
    await this.requireDeal(orgId, dealId);
    await this.prisma.dealInvoice.updateMany({
      where: { id: { in: invoiceIds }, orgId, dealId },
      data: { includeInValue: include },
    });
    return this.recomputeDealValue(orgId, dealId);
  }

  /** Email an estimate to the customer via QuickBooks and mark it sent. */
  async sendEstimate(orgId: string, dealId: string, estimateId: string, email?: string) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est?.qbId) throw new BadRequestException('Estimate is not in QuickBooks');
    await this.requireQboWritable(orgId, est.source);
    const doc = await this.qbo.sendDoc(orgId, 'estimate', est.qbId, email);
    const row = await this.prisma.dealEstimate.update({
      where: { id: estimateId },
      data: { status: 'sent', qbSyncToken: doc.syncToken, qbSyncedAt: new Date() },
      include: { lines: lineSelect },
    });
    return shapeDoc(row);
  }

  /** Email an invoice to the customer via QuickBooks and mark it sent. */
  async sendInvoice(orgId: string, dealId: string, invoiceId: string, email?: string) {
    const inv = await this.prisma.dealInvoice.findFirst({ where: { id: invoiceId, orgId, dealId } });
    if (!inv?.qbId) throw new BadRequestException('Invoice is not in QuickBooks');
    await this.requireQboWritable(orgId, inv.source);
    const doc = await this.qbo.sendDoc(orgId, 'invoice', inv.qbId, email);
    const row = await this.prisma.dealInvoice.update({
      where: { id: invoiceId },
      data: { status: 'sent', qbSyncToken: doc.syncToken, qbSyncedAt: new Date() },
      include: { lines: lineSelect },
    });
    await this.recomputeDealValue(orgId, dealId);
    return shapeDoc(row);
  }

  /**
   * Deal value = every non-void invoice (always — an invoice is a made sale) + every estimate
   * explicitly marked for value (excluding closed/rejected). Only overrides the value when there
   * is at least one such document; otherwise the manually-entered value is left alone.
   */
  /** Deal value is document-driven (status-tier model) — see DealValueService. */
  async recomputeDealValue(orgId: string, dealId: string) {
    return { value: await this.dealValue.recompute(orgId, dealId) };
  }

  async setEstimateStatus(orgId: string, dealId: string, estimateId: string, status: string) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est) throw new NotFoundException('Estimate not found');
    if (est.status === 'closed') {
      throw new BadRequestException('This estimate was converted to an invoice and can no longer be changed');
    }
    await this.requireQboWritable(orgId, est.source);
    if (est.source === 'quickbooks' && est.qbId && est.qbSyncToken) {
      const doc = await this.qbo.updateEstimateStatus(orgId, est.qbId, est.qbSyncToken, TO_TXN_STATUS[status] ?? 'Pending');
      const row = await this.prisma.dealEstimate.update({
        where: { id: estimateId },
        data: { status, qbSyncToken: doc.syncToken, qbSyncedAt: new Date() },
        include: { lines: lineSelect },
      });
      await this.recomputeDealValue(orgId, dealId);
      if (status === 'sent') this.emitDocSent(orgId, dealId, 'estimate');
      return shapeDoc(row);
    }
    const row = await this.prisma.dealEstimate.update({ where: { id: estimateId }, data: { status }, include: { lines: lineSelect } });
    await this.recomputeDealValue(orgId, dealId);
    if (status === 'sent') this.emitDocSent(orgId, dealId, 'estimate');
    return shapeDoc(row);
  }

  // --- Invoices --- (QBO-only; QBO invoices have no settable TxnStatus → status tracked locally)
  async listInvoices(orgId: string, dealId: string) {
    await this.requireDeal(orgId, dealId);
    const rows = await this.prisma.dealInvoice.findMany({
      where: { orgId, dealId, deletedAt: null },
      include: { lines: lineSelect },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(shapeDoc);
  }

  /**
   * Invoices are ALWAYS generated from estimates (never created directly). One or more
   * estimates are combined into a single QBO invoice, linked back to each estimate.
   */
  async createInvoiceFromEstimates(orgId: string, dealId: string, dto: ConvertToInvoiceDto, userId: string) {
    await this.requireQboWritable(orgId, 'quickbooks');
    const deal = await this.requireLinked(orgId, dealId);
    const estimates = await this.prisma.dealEstimate.findMany({
      where: { id: { in: dto.estimateIds }, orgId, dealId, deletedAt: null },
      include: { lines: lineSelect },
    });
    if (estimates.length !== dto.estimateIds.length) {
      throw new BadRequestException('Some selected estimates were not found');
    }
    if (estimates.some((e) => e.status === 'closed')) {
      throw new BadRequestException('Some selected estimates were already converted to an invoice');
    }
    const lines = estimates.flatMap((e) =>
      e.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        ...(l.itemId ? { itemId: l.itemId } : {}),
      })),
    );
    if (!lines.length) throw new BadRequestException('The selected estimates have no line items');

    const linkedTxns = estimates
      .filter((e) => e.qbId)
      .map((e) => ({ txnId: e.qbId as string, txnType: 'Estimate' }));

    const doc = await this.qbo.createInvoice(orgId, {
      customerId: deal.qbSubcustomerId!,
      currency: deal.currency,
      txnDate: dto.txnDate,
      lines,
      billAddr: deal.billTo as Addr,
      shipAddr: deal.shipTo as Addr,
      privateNote: dealPrivateNote(deal),
      memo: dto.memo ?? undefined,
      linkedTxns,
    });

    const row = await this.prisma.dealInvoice.create({
      data: {
        orgId,
        dealId,
        source: 'quickbooks',
        status: dto.status ?? 'draft',
        docNumber: doc.docNumber,
        currency: deal.currency,
        totalAmount: doc.totalAmount,
        txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
        notes: dto.memo ?? null,
        sourceEstimateId: estimates[0].id,
        sourceEstimateIds: estimates.map((e) => e.id),
        qbId: doc.qbId,
        qbSyncToken: doc.syncToken,
        qbSyncedAt: new Date(),
        lines: { create: linesFromDoc(doc) },
      },
      include: { lines: lineSelect },
    });
    // The estimates are now invoiced: close them and drop them from the deal value (the invoice counts instead).
    await this.prisma.dealEstimate.updateMany({
      where: { id: { in: estimates.map((e) => e.id) } },
      data: { status: 'closed', includeInValue: false },
    });
    await this.recomputeDealValue(orgId, dealId); // the new invoice always counts toward the value

    // Log the conversion on the deal timeline.
    const estLabel = estimates.map((e) => (e.docNumber ? `#${e.docNumber}` : 'estimate')).join(', ');
    const invLabel = row.docNumber ? `#${row.docNumber}` : 'invoice';
    await this.prisma.note.create({
      data: { orgId, dealId, authorUserId: userId, body: `🧾 Converted estimate ${estLabel} to invoice ${invLabel}.` },
    });

    this.events.emit('webhook.event', { orgId, type: 'quickbooks.invoice_created', data: { dealId, invoiceId: row.id } });
    return shapeDoc(row);
  }

  async updateInvoice(orgId: string, dealId: string, invoiceId: string, dto: CreateDocDto) {
    const inv = await this.prisma.dealInvoice.findFirst({ where: { id: invoiceId, orgId, dealId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    await this.requireQboWritable(orgId, inv.source);
    const deal = await this.requireLinked(orgId, dealId);
    if (!inv.qbId) throw new BadRequestException('Invoice is not linked to QuickBooks');
    const doc = await this.qbo.updateInvoice(orgId, inv.qbId, this.qboDocInput(deal, dto));
    const row = await this.prisma.dealInvoice.update({
      where: { id: invoiceId },
      data: {
        totalAmount: doc.totalAmount,
        docNumber: doc.docNumber,
        txnDate: dto.txnDate ? new Date(dto.txnDate) : inv.txnDate,
        notes: dto.notes ?? inv.notes,
        qbSyncToken: doc.syncToken,
        qbSyncedAt: new Date(),
        lines: { deleteMany: {}, create: linesFromDoc(doc) },
      },
      include: { lines: lineSelect },
    });
    await this.recomputeDealValue(orgId, dealId);
    return shapeDoc(row);
  }

  async setInvoiceStatus(orgId: string, dealId: string, invoiceId: string, status: string) {
    const inv = await this.prisma.dealInvoice.findFirst({ where: { id: invoiceId, orgId, dealId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    // "Paid" is not a manual choice — it is derived from QuickBooks when the invoice is fully
    // paid (balance = 0). Setting it by hand would lie about money received.
    if (status === 'paid') {
      throw new BadRequestException('An invoice is marked paid automatically when it is fully paid in QuickBooks — it can’t be set manually');
    }
    await this.requireQboWritable(orgId, inv.source);
    // A void must propagate to QuickBooks so the invoice is voided there too (was local-only).
    let qbSyncToken = inv.qbSyncToken;
    if (status === 'void' && inv.source === 'quickbooks' && inv.qbId) {
      qbSyncToken = (await this.qbo.voidInvoice(orgId, inv.qbId)) ?? inv.qbSyncToken;
    }
    const row = await this.prisma.dealInvoice.update({
      where: { id: invoiceId },
      data: { status, qbSyncToken, ...(status === 'void' ? { qbSyncedAt: new Date() } : {}) },
      include: { lines: lineSelect },
    });
    await this.recomputeDealValue(orgId, dealId); // void invoices drop out of the value
    if (status === 'sent') this.emitDocSent(orgId, dealId, 'invoice');
    return shapeDoc(row);
  }

  /** Fire the `deal.doc_sent` event that email automations (FR-16.3) subscribe to. */
  private emitDocSent(orgId: string, dealId: string, docKind: 'estimate' | 'invoice') {
    this.events.emit('webhook.event', { orgId, type: 'deal.doc_sent', data: { deal: { id: dealId }, docKind } });
  }

  /** Keep the QBO sub-customer in sync when a linked deal's name/addresses change. Non-blocking. */
  @OnEvent('webhook.event')
  async onDealEvent(payload: { orgId: string; type: string; data: { deal?: { id?: string; qbSubcustomerId?: string | null; title?: string; billTo?: unknown; shipTo?: unknown } } }) {
    if (payload.type !== 'deal.updated') return;
    const deal = payload.data?.deal;
    if (!deal?.qbSubcustomerId) return;
    if (!(await this.isConnected(payload.orgId))) return;
    try {
      await this.qbo.updateSubCustomer(payload.orgId, deal.qbSubcustomerId, {
        displayName: deal.title,
        billAddr: deal.billTo as Addr,
        shipAddr: deal.shipTo as Addr,
      });
    } catch {
      // best-effort; a QBO hiccup must never break saving a deal
    }
  }

  // --- Inbound QuickBooks webhooks (someone changed an estimate/invoice directly in QBO) ---

  /**
   * Apply a QuickBooks change-notification batch to our local mirror. Keyed by `realmId` (→ orgId).
   * Idempotent + best-effort: each entity is re-read from QBO and upserted; one failing entity
   * never aborts the batch. Only Estimates and Invoices are mirrored.
   */
  async handleQboWebhook(payload: QboWebhookPayload): Promise<void> {
    for (const note of payload?.eventNotifications ?? []) {
      const orgId = await this.qbo.orgIdForRealm(note.realmId);
      if (!orgId) continue; // no connected tenant owns this QBO company
      for (const ent of note.dataChangeEvent?.entities ?? []) {
        try {
          if (ent.name === 'Estimate') await this.reconcileEstimate(orgId, ent.id, ent.operation);
          else if (ent.name === 'Invoice') await this.reconcileInvoice(orgId, ent.id, ent.operation);
        } catch {
          // best-effort per entity — log-and-continue so the rest of the batch still applies
        }
      }
    }
  }

  /** The (non-deleted) deal whose QBO sub-customer matches this doc's CustomerRef, if any. */
  private async dealForQbCustomer(orgId: string, qbCustomerId: string | null) {
    if (!qbCustomerId) return null;
    return this.prisma.deal.findFirst({
      where: { orgId, deletedAt: null, qbSubcustomerId: qbCustomerId },
      select: { id: true, currency: true, ownerUserId: true },
    });
  }

  /**
   * An invoice pulled/updated from QBO may have been created FROM one or more estimates
   * (LinkedTxn). Mirror the in-app conversion: close those source estimates, link them on the
   * invoice, and — only when we actually close something (i.e. this is the first time we see the
   * conversion, so it wasn't done in-app) — log it on the deal timeline. Idempotent.
   */
  private async applyQboInvoiceLinks(
    orgId: string,
    dealId: string,
    invoice: { id: string; docNumber: string | null },
    doc: NormalizedDoc,
    authorUserId: string,
  ) {
    const estTxnIds = doc.linkedTxns.filter((t) => t.txnType === 'Estimate').map((t) => t.txnId);
    if (!estTxnIds.length) return;
    const ests = await this.prisma.dealEstimate.findMany({
      where: { orgId, dealId, source: 'quickbooks', qbId: { in: estTxnIds }, deletedAt: null },
    });
    if (!ests.length) return;
    await this.prisma.dealInvoice.update({
      where: { id: invoice.id },
      data: { sourceEstimateId: ests[0].id, sourceEstimateIds: ests.map((e) => e.id) },
    });
    const toClose = ests.filter((e) => e.status !== 'closed');
    if (!toClose.length) return; // already converted (e.g. an in-app conversion we're echoing) — nothing to log
    await this.prisma.dealEstimate.updateMany({
      where: { id: { in: toClose.map((e) => e.id) } },
      data: { status: 'closed', includeInValue: false },
    });
    const estLabel = toClose.map((e) => (e.docNumber ? `#${e.docNumber}` : 'estimate')).join(', ');
    const invLabel = invoice.docNumber ? `#${invoice.docNumber}` : 'invoice';
    await this.prisma.note.create({
      data: { orgId, dealId, authorUserId, body: `🧾 Converted estimate ${estLabel} to invoice ${invLabel} (in QuickBooks).` },
    });
  }

  private async reconcileEstimate(orgId: string, qbId: string, operation: string) {
    const existing = await this.prisma.dealEstimate.findFirst({ where: { orgId, source: 'quickbooks', qbId } });
    if (operation === 'Delete') {
      if (existing && !existing.deletedAt) {
        await this.prisma.dealEstimate.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
        await this.recomputeDealValue(orgId, existing.dealId);
      }
      return;
    }
    const doc = await this.qbo.getEstimate(orgId, qbId);
    if (!doc) {
      // Gone in QBO — soft-delete our copy so it drops out of the value.
      if (existing && !existing.deletedAt) {
        await this.prisma.dealEstimate.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
        await this.recomputeDealValue(orgId, existing.dealId);
      }
      return;
    }
    if (existing) {
      const status = this.deriveEstimateStatus(doc, existing.status);
      await this.prisma.dealEstimate.update({
        where: { id: existing.id },
        data: {
          status,
          docNumber: doc.docNumber,
          totalAmount: doc.totalAmount,
          txnDate: doc.txnDate ? new Date(doc.txnDate) : existing.txnDate,
          qbSyncToken: doc.syncToken,
          qbSyncedAt: new Date(),
          deletedAt: null, // a QBO update resurrects a doc we'd soft-deleted
          lines: { deleteMany: {}, create: linesFromDoc(doc) },
        },
      });
      await this.recomputeDealValue(orgId, existing.dealId);
      this.events.emit('webhook.event', { orgId, type: 'quickbooks.estimate_updated', data: { dealId: existing.dealId, estimateId: existing.id } });
      return;
    }
    // New estimate created directly in QBO — attach it to the deal that owns its customer.
    const deal = await this.dealForQbCustomer(orgId, doc.qbCustomerId);
    if (!deal) return;
    const row = await this.prisma.dealEstimate.create({
      data: {
        orgId,
        dealId: deal.id,
        source: 'quickbooks',
        status: FROM_TXN_STATUS[doc.status ?? 'Pending'] ?? 'draft',
        docNumber: doc.docNumber,
        currency: deal.currency,
        totalAmount: doc.totalAmount,
        txnDate: doc.txnDate ? new Date(doc.txnDate) : null,
        includeInValue: true,
        qbId: doc.qbId,
        qbSyncToken: doc.syncToken,
        qbSyncedAt: new Date(),
        lines: { create: linesFromDoc(doc) },
      },
    });
    await this.recomputeDealValue(orgId, deal.id);
    this.events.emit('webhook.event', { orgId, type: 'quickbooks.estimate_synced', data: { dealId: deal.id, estimateId: row.id } });
  }

  /**
   * Estimate status from a re-read QBO doc. QBO has no draft/sent distinction (both are `Pending`),
   * so a re-sync must NOT downgrade a locally-`sent` estimate to draft; a converted (`closed`) one
   * is never reopened. Only an explicit QBO Accepted/Rejected/Closed moves the status.
   */
  private deriveEstimateStatus(doc: NormalizedDoc, current: string): string {
    if (current === 'closed') return 'closed';
    const mapped = FROM_TXN_STATUS[doc.status ?? 'Pending'] ?? current;
    if (mapped === 'draft') return current === 'sent' ? 'sent' : 'draft'; // Pending = draft|sent — keep local
    return mapped; // accepted | rejected | closed
  }

  /** Invoice status from a re-read QBO doc: fully paid (balance 0) → paid; void stays void. */
  private deriveInvoiceStatus(doc: NormalizedDoc, current: string): string {
    if (current === 'void') return 'void';
    if (doc.totalAmount > 0 && doc.balance === 0) return 'paid';
    if (current === 'paid') return 'sent'; // a payment was reversed → no longer paid
    return current === 'draft' ? 'draft' : 'sent';
  }

  private async reconcileInvoice(orgId: string, qbId: string, operation: string) {
    const existing = await this.prisma.dealInvoice.findFirst({ where: { orgId, source: 'quickbooks', qbId } });
    if (operation === 'Delete') {
      if (existing && !existing.deletedAt) {
        await this.prisma.dealInvoice.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
        await this.recomputeDealValue(orgId, existing.dealId);
      }
      return;
    }
    if (operation === 'Void') {
      if (existing && existing.status !== 'void') {
        await this.prisma.dealInvoice.update({ where: { id: existing.id }, data: { status: 'void', qbSyncedAt: new Date() } });
        await this.recomputeDealValue(orgId, existing.dealId);
        this.events.emit('webhook.event', { orgId, type: 'quickbooks.invoice_updated', data: { dealId: existing.dealId, invoiceId: existing.id } });
      }
      return;
    }
    const doc = await this.qbo.getInvoice(orgId, qbId);
    if (!doc) {
      if (existing && !existing.deletedAt) {
        await this.prisma.dealInvoice.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
        await this.recomputeDealValue(orgId, existing.dealId);
      }
      return;
    }
    if (existing) {
      await this.prisma.dealInvoice.update({
        where: { id: existing.id },
        data: {
          status: this.deriveInvoiceStatus(doc, existing.status),
          docNumber: doc.docNumber,
          totalAmount: doc.totalAmount,
          txnDate: doc.txnDate ? new Date(doc.txnDate) : existing.txnDate,
          qbSyncToken: doc.syncToken,
          qbSyncedAt: new Date(),
          deletedAt: null,
          lines: { deleteMany: {}, create: linesFromDoc(doc) },
        },
      });
      await this.recomputeDealValue(orgId, existing.dealId);
      this.events.emit('webhook.event', { orgId, type: 'quickbooks.invoice_updated', data: { dealId: existing.dealId, invoiceId: existing.id } });
      return;
    }
    // New invoice created directly in QBO — attach it to the deal that owns its customer.
    const deal = await this.dealForQbCustomer(orgId, doc.qbCustomerId);
    if (!deal) return;
    const row = await this.prisma.dealInvoice.create({
      data: {
        orgId,
        dealId: deal.id,
        source: 'quickbooks',
        status: this.deriveInvoiceStatus(doc, 'sent'),
        docNumber: doc.docNumber,
        currency: deal.currency,
        totalAmount: doc.totalAmount,
        txnDate: doc.txnDate ? new Date(doc.txnDate) : null,
        qbId: doc.qbId,
        qbSyncToken: doc.syncToken,
        qbSyncedAt: new Date(),
        lines: { create: linesFromDoc(doc) },
      },
    });
    // If this invoice was created FROM estimates in QBO, close them + log the conversion (like the in-app flow).
    await this.applyQboInvoiceLinks(orgId, deal.id, { id: row.id, docNumber: row.docNumber }, doc, deal.ownerUserId);
    await this.recomputeDealValue(orgId, deal.id);
    this.events.emit('webhook.event', { orgId, type: 'quickbooks.invoice_created', data: { dealId: deal.id, invoiceId: row.id } });
  }
}

/** Shape of an Intuit/QuickBooks Online webhook payload (only the fields we consume). */
export interface QboWebhookPayload {
  eventNotifications?: {
    realmId: string;
    dataChangeEvent?: {
      entities?: { name: string; id: string; operation: string; lastUpdated?: string }[];
    };
  }[];
}

function linesFromDoc(doc: NormalizedDoc) {
  return doc.lines.map((l, i) => ({
    position: i,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    amount: l.amount,
    qbLineId: l.qbLineId,
    itemId: l.itemId,
    itemName: l.itemName,
  }));
}

function nativeLines(dto: CreateDocDto) {
  return dto.lines.map((l, i) => ({
    position: i,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit ?? null,
    unitPrice: l.unitPrice,
    amount: l.quantity * l.unitPrice,
    qbLineId: null,
    itemId: l.itemId ?? null,
    itemName: null,
  }));
}

function nativeSubtotal(dto: CreateDocDto) {
  return dto.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

/** Native doc total = subtotal + tax (tax = subtotal × taxRateBps / 10000). */
function nativeTotal(dto: CreateDocDto) {
  const bps = dto.taxRateBps ?? 0;
  const subtotal = nativeSubtotal(dto);
  return subtotal + (bps > 0 ? Math.round((subtotal * bps) / 10000) : 0);
}

type DocRow = {
  id: string;
  dealId: string;
  source: string;
  status: string;
  docNumber: string | null;
  currency: string;
  totalAmount: number;
  taxRateBps?: number;
  txnDate: Date | null;
  notes: string | null;
  qbId: string | null;
  sourceEstimateId?: string | null;
  sourceEstimateIds?: string[];
  includeInValue?: boolean;
  createdAt: Date;
  lines: {
    id: string;
    position: number;
    description: string;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    amount: number;
    itemId: string | null;
    itemName: string | null;
  }[];
};

function shapeDoc(d: DocRow) {
  return {
    id: d.id,
    dealId: d.dealId,
    source: d.source,
    status: d.status,
    docNumber: d.docNumber,
    currency: d.currency,
    totalAmount: d.totalAmount,
    taxRateBps: d.taxRateBps ?? 0,
    txnDate: d.txnDate,
    notes: d.notes,
    qbId: d.qbId,
    sourceEstimateId: d.sourceEstimateId ?? null,
    sourceEstimateIds: d.sourceEstimateIds ?? [],
    includeInValue: d.includeInValue ?? false,
    createdAt: d.createdAt,
    lines: d.lines.map((l) => ({
      id: l.id,
      position: l.position,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      amount: l.amount,
      itemId: l.itemId,
      itemName: l.itemName,
    })),
  };
}
