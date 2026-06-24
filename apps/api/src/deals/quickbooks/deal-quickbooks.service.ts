import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { QuickbooksApiService, type DocInput, type NormalizedDoc } from '../../integrations/quickbooks-api.service';
import { ConvertToInvoiceDto, CreateDocDto, LinkQuickbooksDto } from './dto/quickbooks.dto';

// our estimate status <-> QBO TxnStatus
const TO_TXN_STATUS: Record<string, string> = { accepted: 'Accepted', rejected: 'Rejected', closed: 'Closed', sent: 'Pending', draft: 'Pending' };
const FROM_TXN_STATUS: Record<string, string> = { Accepted: 'accepted', Rejected: 'rejected', Closed: 'closed', Pending: 'sent' };

const lineSelect = { orderBy: { position: 'asc' as const } };
type Addr = Record<string, string> | null;
type DealForQbo = { id: string; refNumber: number | null; qbSubcustomerId: string | null; currency: string; shipTo: unknown; billTo: unknown };

function dealPrivateNote(deal: DealForQbo) {
  return `Candango deal #${deal.refNumber ?? '?'} (${deal.id})`;
}

@Injectable()
export class DealQuickbooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qbo: QuickbooksApiService,
    private readonly events: EventEmitter2,
  ) {}

  private async requireDeal(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId, deletedAt: null },
      include: { company: { select: { name: true } }, primaryPerson: { select: { name: true } } },
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
    const clientName = deal.company?.name ?? deal.primaryPerson?.name ?? deal.title;

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
    if (await this.isConnected(orgId)) {
      const deal = await this.requireLinked(orgId, dealId);
      const doc = await this.qbo.createEstimate(orgId, this.qboDocInput(deal, dto));
      const row = await this.prisma.dealEstimate.create({
        data: {
          orgId,
          dealId,
          source: 'quickbooks',
          status: FROM_TXN_STATUS[doc.status ?? 'Pending'] ?? 'sent',
          docNumber: doc.docNumber,
          currency: deal.currency,
          totalAmount: doc.totalAmount,
          txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
          notes: dto.notes ?? null,
          qbId: doc.qbId,
          qbSyncToken: doc.syncToken,
          qbSyncedAt: new Date(),
          lines: { create: linesFromDoc(doc) },
        },
        include: { lines: lineSelect },
      });
      this.events.emit('webhook.event', { orgId, type: 'quickbooks.estimate_synced', data: { dealId, estimateId: row.id } });
      return shapeDoc(row);
    }

    // Native (offline) estimate — amounts computed server-side.
    const deal = await this.requireDeal(orgId, dealId);
    const row = await this.prisma.dealEstimate.create({
      data: {
        orgId,
        dealId,
        source: 'native',
        status: 'draft',
        currency: deal.currency,
        totalAmount: nativeTotal(dto),
        txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
        notes: dto.notes ?? null,
        lines: { create: nativeLines(dto) },
      },
      include: { lines: lineSelect },
    });
    return shapeDoc(row);
  }

  async updateEstimate(orgId: string, dealId: string, estimateId: string, dto: CreateDocDto) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est) throw new NotFoundException('Estimate not found');
    if (est.status === 'closed') {
      throw new BadRequestException('This estimate was converted to an invoice and can no longer be edited');
    }
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
        txnDate: dto.txnDate ? new Date(dto.txnDate) : est.txnDate,
        notes: dto.notes ?? est.notes,
        lines: { deleteMany: {}, create: nativeLines(dto) },
      },
      include: { lines: lineSelect },
    });
    await this.recomputeDealValue(orgId, dealId);
    return shapeDoc(row);
  }

  /** Mark/unmark estimates so they count toward the deal value, then recompute. */
  async includeEstimatesInValue(orgId: string, dealId: string, estimateIds: string[], include: boolean) {
    await this.requireDeal(orgId, dealId);
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
  async recomputeDealValue(orgId: string, dealId: string) {
    const [invoices, estimates] = await Promise.all([
      // Invoices always count toward the deal value (a made sale) — only voided ones drop out.
      this.prisma.dealInvoice.findMany({
        where: { orgId, dealId, deletedAt: null, status: { not: 'void' } },
        select: { totalAmount: true },
      }),
      this.prisma.dealEstimate.findMany({
        where: { orgId, dealId, deletedAt: null, includeInValue: true, status: { notIn: ['closed', 'rejected'] } },
        select: { totalAmount: true },
      }),
    ]);
    const sum = (xs: { totalAmount: number }[]) => xs.reduce((s, x) => s + x.totalAmount, 0);
    const value = sum(invoices) + sum(estimates);
    if (invoices.length || estimates.length) {
      await this.prisma.deal.update({ where: { id: dealId }, data: { value, valueOverridden: true } });
    }
    return { value };
  }

  async setEstimateStatus(orgId: string, dealId: string, estimateId: string, status: string) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est) throw new NotFoundException('Estimate not found');
    if (est.status === 'closed') {
      throw new BadRequestException('This estimate was converted to an invoice and can no longer be changed');
    }
    if (est.source === 'quickbooks' && est.qbId && est.qbSyncToken) {
      const doc = await this.qbo.updateEstimateStatus(orgId, est.qbId, est.qbSyncToken, TO_TXN_STATUS[status] ?? 'Pending');
      const row = await this.prisma.dealEstimate.update({
        where: { id: estimateId },
        data: { status, qbSyncToken: doc.syncToken, qbSyncedAt: new Date() },
        include: { lines: lineSelect },
      });
      await this.recomputeDealValue(orgId, dealId);
      return shapeDoc(row);
    }
    const row = await this.prisma.dealEstimate.update({ where: { id: estimateId }, data: { status }, include: { lines: lineSelect } });
    await this.recomputeDealValue(orgId, dealId);
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
    const row = await this.prisma.dealInvoice.update({ where: { id: invoiceId }, data: { status }, include: { lines: lineSelect } });
    await this.recomputeDealValue(orgId, dealId); // void invoices drop out of the value
    return shapeDoc(row);
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
    unitPrice: l.unitPrice,
    amount: l.quantity * l.unitPrice,
    qbLineId: null,
    itemId: l.itemId ?? null,
    itemName: null,
  }));
}

function nativeTotal(dto: CreateDocDto) {
  return dto.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

type DocRow = {
  id: string;
  dealId: string;
  source: string;
  status: string;
  docNumber: string | null;
  currency: string;
  totalAmount: number;
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
      unitPrice: l.unitPrice,
      amount: l.amount,
      itemId: l.itemId,
      itemName: l.itemName,
    })),
  };
}
