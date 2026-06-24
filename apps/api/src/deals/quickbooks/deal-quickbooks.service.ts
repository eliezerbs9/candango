import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { QuickbooksApiService, type NormalizedDoc } from '../../integrations/quickbooks-api.service';
import { CreateDocDto, LinkQuickbooksDto } from './dto/quickbooks.dto';

// our estimate status <-> QBO TxnStatus
const TO_TXN_STATUS: Record<string, string> = { accepted: 'Accepted', rejected: 'Rejected', closed: 'Closed', sent: 'Pending', draft: 'Pending' };
const FROM_TXN_STATUS: Record<string, string> = { Accepted: 'accepted', Rejected: 'rejected', Closed: 'closed', Pending: 'sent' };

const lineSelect = { orderBy: { position: 'asc' as const } };

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

  // --- Account linking ---
  async link(orgId: string, dealId: string, dto: LinkQuickbooksDto) {
    const deal = await this.requireDeal(orgId, dealId);
    const clientType = deal.companyId ? 'company' : deal.primaryPersonId ? 'person' : null;
    const clientId = deal.companyId ?? deal.primaryPersonId ?? null;
    const clientName = deal.company?.name ?? deal.primaryPerson?.name ?? deal.title;

    // Resolve the parent Customer: explicit id → existing link → create from the client.
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
      shipAddr: deal.shipTo as Record<string, string> | null,
      billAddr: deal.billTo as Record<string, string> | null,
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
      const doc = await this.qbo.createEstimate(orgId, {
        customerId: deal.qbSubcustomerId!,
        currency: deal.currency,
        txnDate: dto.txnDate,
        lines: dto.lines,
      });
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
    const lines = dto.lines.map((l, i) => ({
      position: i,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.quantity * l.unitPrice,
      qbLineId: null,
    }));
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    const row = await this.prisma.dealEstimate.create({
      data: {
        orgId,
        dealId,
        source: 'native',
        status: 'draft',
        currency: deal.currency,
        totalAmount: total,
        txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
        notes: dto.notes ?? null,
        lines: { create: lines },
      },
      include: { lines: lineSelect },
    });
    return shapeDoc(row);
  }

  /** Push an estimate's total onto the deal value (explicit, user-triggered pricing). */
  async useEstimateAsValue(orgId: string, dealId: string, estimateId: string) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est) throw new NotFoundException('Estimate not found');
    await this.prisma.deal.update({ where: { id: dealId }, data: { value: est.totalAmount, valueOverridden: true } });
    return { value: est.totalAmount };
  }

  async setEstimateStatus(orgId: string, dealId: string, estimateId: string, status: string) {
    const est = await this.prisma.dealEstimate.findFirst({ where: { id: estimateId, orgId, dealId } });
    if (!est) throw new NotFoundException('Estimate not found');
    if (est.source === 'quickbooks' && est.qbId && est.qbSyncToken) {
      const doc = await this.qbo.updateEstimateStatus(orgId, est.qbId, est.qbSyncToken, TO_TXN_STATUS[status] ?? 'Pending');
      const row = await this.prisma.dealEstimate.update({
        where: { id: estimateId },
        data: { status, qbSyncToken: doc.syncToken, qbSyncedAt: new Date() },
        include: { lines: lineSelect },
      });
      return shapeDoc(row);
    }
    const row = await this.prisma.dealEstimate.update({ where: { id: estimateId }, data: { status }, include: { lines: lineSelect } });
    return shapeDoc(row);
  }

  // --- Invoices --- (QBO invoices have no settable TxnStatus; status is tracked locally in Phase 1)
  async listInvoices(orgId: string, dealId: string) {
    await this.requireDeal(orgId, dealId);
    const rows = await this.prisma.dealInvoice.findMany({
      where: { orgId, dealId, deletedAt: null },
      include: { lines: lineSelect },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(shapeDoc);
  }

  async createInvoice(orgId: string, dealId: string, dto: CreateDocDto) {
    const deal = await this.requireLinked(orgId, dealId);
    const doc = await this.qbo.createInvoice(orgId, {
      customerId: deal.qbSubcustomerId!,
      currency: deal.currency,
      txnDate: dto.txnDate,
      lines: dto.lines,
    });
    const row = await this.prisma.dealInvoice.create({
      data: {
        orgId,
        dealId,
        source: 'quickbooks',
        status: 'sent',
        docNumber: doc.docNumber,
        currency: deal.currency,
        totalAmount: doc.totalAmount,
        txnDate: dto.txnDate ? new Date(dto.txnDate) : null,
        notes: dto.notes ?? null,
        sourceEstimateId: dto.sourceEstimateId ?? null,
        qbId: doc.qbId,
        qbSyncToken: doc.syncToken,
        qbSyncedAt: new Date(),
        lines: { create: linesFromDoc(doc) },
      },
      include: { lines: lineSelect },
    });
    this.events.emit('webhook.event', { orgId, type: 'quickbooks.invoice_created', data: { dealId, invoiceId: row.id } });
    return shapeDoc(row);
  }

  async setInvoiceStatus(orgId: string, dealId: string, invoiceId: string, status: string) {
    const inv = await this.prisma.dealInvoice.findFirst({ where: { id: invoiceId, orgId, dealId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const row = await this.prisma.dealInvoice.update({ where: { id: invoiceId }, data: { status }, include: { lines: lineSelect } });
    return shapeDoc(row);
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
  }));
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
  createdAt: Date;
  lines: { id: string; position: number; description: string; quantity: number; unitPrice: number; amount: number }[];
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
    createdAt: d.createdAt,
    lines: d.lines.map((l) => ({
      id: l.id,
      position: l.position,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
    })),
  };
}
