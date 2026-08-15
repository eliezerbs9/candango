import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OAuthClient from 'intuit-oauth';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken, encryptToken } from './crypto.util';

const MINOR_VERSION = '73';
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Our deal address Json → QBO address shape (undefined if empty).
 * `name` becomes the first address line so the printed Bill To/Ship To shows the
 * company/person, not the deal title. */
type Addr = Record<string, string> | null | undefined;
function toQbAddr(a: Addr) {
  const x = (a ?? {}) as Record<string, string>;
  const lines = [x.name, x.line1, x.line2].filter((v): v is string => !!v);
  const out: Record<string, string> = {};
  lines.forEach((l, i) => {
    out[`Line${i + 1}`] = l;
  });
  if (x.city) out.City = x.city;
  if (x.state) out.CountrySubDivisionCode = x.state;
  if (x.postalCode) out.PostalCode = x.postalCode;
  if (x.country) out.Country = x.country;
  return Object.keys(out).length ? out : undefined;
}

const toQbAmount = (cents: number) => Math.round(cents) / 100; // minor units → decimal
const fromQbAmount = (dollars: number | string | undefined) => Math.round(Number(dollars ?? 0) * 100);

export interface LineInput {
  description: string;
  quantity: number;
  unitPrice: number; // minor units
  itemId?: string; // QBO Item (Product/Service) ref; falls back to a default Service item
}
export interface DocInput {
  customerId: string;
  currency?: string;
  txnDate?: string;
  lines: LineInput[];
  billAddr?: Addr;
  shipAddr?: Addr;
  privateNote?: string; // internal note (traceability: deal ref + id) — QBO PrivateNote
  memo?: string; // customer-facing message shown on the document — QBO CustomerMemo
  linkedTxns?: { txnId: string; txnType: string }[]; // e.g. estimates this invoice was generated from
}
export interface NormalizedLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  qbLineId: string | null;
  itemId: string | null;
  itemName: string | null;
}
export interface NormalizedDoc {
  qbId: string;
  docNumber: string | null;
  status: string | null; // QBO TxnStatus (estimates only; invoices have none)
  totalAmount: number; // minor units (QBO TotalAmt — source of truth incl. tax)
  balance: number; // minor units (QBO Balance — invoices; 0 when fully paid)
  qbCustomerId: string | null; // CustomerRef.value — used to match a doc back to a deal
  txnDate: string | null; // QBO TxnDate (YYYY-MM-DD)
  linkedTxns: { txnId: string; txnType: string }[]; // e.g. the estimate(s) an invoice was created from
  syncToken: string;
  lines: NormalizedLine[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Low-level QuickBooks Online Accounting API client with refresh-on-use. One connection per org. */
@Injectable()
export class QuickbooksApiService {
  private readonly logger = new Logger(QuickbooksApiService.name);
  private itemRefCache = new Map<string, string>(); // realmId → default Service item id

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private baseUrl() {
    return (this.config.get<string>('QBO_ENVIRONMENT') ?? 'sandbox') === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  /** Returns a fresh access token + realmId, refreshing (and persisting rotated tokens) if near expiry. */
  private async authContext(orgId: string): Promise<{ accessToken: string; realmId: string }> {
    const conn = await this.prisma.quickBooksConnection.findUnique({ where: { orgId } });
    if (!conn || conn.status !== 'connected' || !conn.refreshToken) {
      throw new BadRequestException('QuickBooks is not connected for this workspace');
    }
    const expired = !conn.tokenExpiry || conn.tokenExpiry.getTime() < Date.now() + REFRESH_SKEW_MS;
    if (!expired) {
      return { accessToken: decryptToken(conn.accessToken), realmId: conn.realmId };
    }

    const oauth = new OAuthClient({
      clientId: this.config.get<string>('QBO_CLIENT_ID') ?? '',
      clientSecret: this.config.get<string>('QBO_CLIENT_SECRET') ?? '',
      environment: (this.config.get<string>('QBO_ENVIRONMENT') ?? 'sandbox') as 'sandbox' | 'production',
      redirectUri: this.config.get<string>('QBO_REDIRECT_URI') ?? '',
    });
    oauth.setToken({
      token_type: 'bearer',
      access_token: decryptToken(conn.accessToken),
      refresh_token: decryptToken(conn.refreshToken),
      expires_in: 3600,
      x_refresh_token_expires_in: 8640000,
      realmId: conn.realmId,
    });
    try {
      const t = (await oauth.refresh()).getJson();
      const now = Date.now();
      await this.prisma.quickBooksConnection.update({
        where: { orgId },
        data: {
          accessToken: encryptToken(t.access_token),
          refreshToken: encryptToken(t.refresh_token),
          tokenExpiry: new Date(now + (t.expires_in ?? 3600) * 1000),
          refreshTokenExpiry: new Date(now + (t.x_refresh_token_expires_in ?? 8640000) * 1000),
          lastRefreshAt: new Date(),
          status: 'connected',
          lastError: null,
        },
      });
      return { accessToken: t.access_token, realmId: conn.realmId };
    } catch (e) {
      const err = e as { authResponse?: { status?: number }; message?: string };
      if (err.authResponse?.status === 400 || err.authResponse?.status === 401) {
        await this.prisma.quickBooksConnection.update({
          where: { orgId },
          data: { status: 'reauth_required', lastError: `Refresh failed: ${err.message ?? ''}`.slice(0, 300) },
        });
        throw new BadRequestException('QuickBooks needs to be reconnected');
      }
      throw new BadRequestException('QuickBooks token refresh failed');
    }
  }

  /** GET/POST a QBO Accounting endpoint; throws a friendly error on a QBO Fault. */
  private async request(orgId: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    const { accessToken, realmId } = await this.authContext(orgId);
    const sep = path.includes('?') ? '&' : '?';
    const url = `${this.baseUrl()}/v3/company/${realmId}/${path}${sep}minorversion=${MINOR_VERSION}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    // intuit_tid: Intuit's per-request trace id — capture it from every response so it can
    // be quoted to Intuit support when troubleshooting (recommended in their app review).
    const tid = res.headers.get('intuit_tid') ?? 'none';
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fault = json?.Fault?.Error?.[0];
      const msg = fault?.Detail ?? fault?.Message ?? `QBO error ${res.status}`;
      // Structured error log for troubleshooting: trace id + status + endpoint + QBO fault code/message.
      this.logger.error(
        `QBO API error — status=${res.status} intuit_tid=${tid} method=${method} path=${path} ` +
          `code=${fault?.code ?? 'n/a'} message=${fault?.Message ?? msg}`,
      );
      throw new BadRequestException(`QuickBooks: ${msg} (ref: ${tid})`);
    }
    return json;
  }

  private async query(orgId: string, sql: string): Promise<any> {
    return this.request(orgId, 'GET', `query?query=${encodeURIComponent(sql)}`);
  }

  /** A default Service item id (required on every QBO line), cached per realm. */
  private async defaultItemId(orgId: string, realmId: string): Promise<string> {
    const cached = this.itemRefCache.get(realmId);
    if (cached) return cached;
    const r = await this.query(orgId, "select * from Item where Type = 'Service' MAXRESULTS 1");
    const id = r?.QueryResponse?.Item?.[0]?.Id;
    if (!id) throw new BadRequestException('No QuickBooks service item found to bill against');
    this.itemRefCache.set(realmId, id);
    return id;
  }

  // --- Items (Products / Services) ---
  // QuickBooks Items carry a UnitPrice (auto-filled on the estimate) but no unit
  // of measure in the standard API, so `unit` isn't available for QBO items.
  async listItems(
    orgId: string,
  ): Promise<{ id: string; name: string; description: string | null; unitPrice: number | null; taxable: boolean }[]> {
    const r = await this.query(
      orgId,
      "select Id, Name, Description, UnitPrice, Taxable from Item where Active = true and Type in ('Service','Inventory','NonInventory') MAXRESULTS 200",
    );
    return (r?.QueryResponse?.Item ?? []).map((i: any) => ({
      id: i.Id,
      name: i.Name,
      description: i.Description ?? null,
      unitPrice: i.UnitPrice != null ? fromQbAmount(i.UnitPrice) : null,
      taxable: !!i.Taxable,
    }));
  }

  /** Sparse-update a QuickBooks item (re-reads its SyncToken first). */
  async updateItem(
    orgId: string,
    id: string,
    patch: { name?: string; description?: string; unitPrice?: number; taxable?: boolean },
  ): Promise<{ id: string; name: string; description: string | null; unitPrice: number | null; taxable: boolean }> {
    const cur = await this.query(orgId, `select * from Item where Id = '${id.replace(/'/g, '')}'`);
    const item = cur?.QueryResponse?.Item?.[0];
    if (!item) throw new BadRequestException('QuickBooks item not found');
    const body: Record<string, unknown> = { Id: id, SyncToken: item.SyncToken, sparse: true };
    if (patch.name !== undefined) body.Name = patch.name;
    if (patch.description !== undefined) body.Description = patch.description;
    if (patch.unitPrice !== undefined) body.UnitPrice = toQbAmount(patch.unitPrice);
    if (patch.taxable !== undefined) body.Taxable = patch.taxable;
    const r = await this.request(orgId, 'POST', 'item', body);
    const it = r.Item;
    return {
      id: it.Id,
      name: it.Name,
      description: it.Description ?? null,
      unitPrice: it.UnitPrice != null ? fromQbAmount(it.UnitPrice) : null,
      taxable: !!it.Taxable,
    };
  }

  /** QuickBooks items aren't hard-deleted — deactivate them (Active = false). */
  async deactivateItem(orgId: string, id: string): Promise<void> {
    const cur = await this.query(orgId, `select * from Item where Id = '${id.replace(/'/g, '')}'`);
    const item = cur?.QueryResponse?.Item?.[0];
    if (!item) return;
    await this.request(orgId, 'POST', 'item', { Id: id, SyncToken: item.SyncToken, sparse: true, Active: false });
  }

  private incomeAccountCache = new Map<string, string>(); // realmId → default Income account id
  private async defaultIncomeAccountId(orgId: string, realmId: string): Promise<string> {
    const cached = this.incomeAccountCache.get(realmId);
    if (cached) return cached;
    const r = await this.query(orgId, "select Id from Account where AccountType = 'Income' and Active = true MAXRESULTS 1");
    const id = r?.QueryResponse?.Account?.[0]?.Id;
    if (!id) throw new BadRequestException('No QuickBooks income account found to create an item');
    this.incomeAccountCache.set(realmId, id);
    return id;
  }

  /** Create a Service item in QuickBooks (needs an income account). */
  async createItem(
    orgId: string,
    input: { name: string; description?: string; unitPrice?: number; taxable?: boolean },
  ): Promise<{ id: string; name: string; description: string | null; unitPrice: number | null; taxable: boolean }> {
    const { realmId } = await this.authContext(orgId);
    const body: Record<string, unknown> = {
      Name: input.name,
      Type: 'Service',
      IncomeAccountRef: { value: await this.defaultIncomeAccountId(orgId, realmId) },
    };
    if (input.description) body.Description = input.description;
    if (input.unitPrice != null) body.UnitPrice = toQbAmount(input.unitPrice);
    if (input.taxable !== undefined) body.Taxable = input.taxable;
    const r = await this.request(orgId, 'POST', 'item', body);
    const it = r.Item;
    return {
      id: it.Id,
      name: it.Name,
      description: it.Description ?? null,
      unitPrice: it.UnitPrice != null ? fromQbAmount(it.UnitPrice) : null,
      taxable: !!it.Taxable,
    };
  }

  // --- Customers ---
  async searchCustomers(orgId: string, q: string): Promise<{ id: string; name: string }[]> {
    const safe = q.replace(/['\\]/g, '');
    const sql = safe
      ? `select Id, DisplayName from Customer where Active = true and DisplayName like '%${safe}%' MAXRESULTS 20`
      : 'select Id, DisplayName from Customer where Active = true MAXRESULTS 20';
    const r = await this.query(orgId, sql);
    return (r?.QueryResponse?.Customer ?? []).map((c: any) => ({ id: c.Id, name: c.DisplayName }));
  }

  async createCustomer(orgId: string, displayName: string): Promise<{ id: string; name: string }> {
    const r = await this.request(orgId, 'POST', 'customer', { DisplayName: displayName });
    return { id: r.Customer.Id, name: r.Customer.DisplayName };
  }

  /** Create a sub-customer (Job) under a parent Customer, with ship/bill addresses. */
  async createSubCustomer(
    orgId: string,
    input: { displayName: string; parentCustomerId: string; shipAddr?: Addr; billAddr?: Addr },
  ): Promise<{ id: string; name: string }> {
    const body: Record<string, unknown> = {
      DisplayName: input.displayName,
      Job: true,
      ParentRef: { value: input.parentCustomerId },
      BillWithParent: true,
    };
    const ship = toQbAddr(input.shipAddr);
    const bill = toQbAddr(input.billAddr);
    if (ship) body.ShipAddr = ship;
    if (bill) body.BillAddr = bill;
    const r = await this.request(orgId, 'POST', 'customer', body);
    return { id: r.Customer.Id, name: r.Customer.DisplayName };
  }

  /** Sparse-update a sub-customer's name + addresses (reads the current SyncToken first). */
  async updateSubCustomer(
    orgId: string,
    qbCustomerId: string,
    input: { displayName?: string; shipAddr?: Addr; billAddr?: Addr },
  ): Promise<void> {
    const cur = await this.query(orgId, `select Id, SyncToken from Customer where Id = '${qbCustomerId}'`);
    const syncToken = cur?.QueryResponse?.Customer?.[0]?.SyncToken;
    if (syncToken == null) return; // customer gone; nothing to sync
    const body: Record<string, unknown> = { Id: qbCustomerId, SyncToken: syncToken, sparse: true };
    if (input.displayName) body.DisplayName = input.displayName;
    const ship = toQbAddr(input.shipAddr);
    const bill = toQbAddr(input.billAddr);
    if (ship) body.ShipAddr = ship;
    if (bill) body.BillAddr = bill;
    await this.request(orgId, 'POST', 'customer', body);
  }

  // --- Estimates / Invoices ---
  /** Which of these QBO items are marked Taxable — so lines match QuickBooks' own behaviour. */
  private async itemTaxableMap(orgId: string, itemIds: string[]): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>();
    if (!itemIds.length) return map;
    const inList = itemIds.map((id) => `'${id.replace(/'/g, '')}'`).join(',');
    const r = await this.query(orgId, `select Id, Taxable from Item where Id in (${inList})`);
    for (const it of r?.QueryResponse?.Item ?? []) map.set(it.Id, !!it.Taxable);
    return map;
  }

  private async buildLines(orgId: string, realmId: string, lines: LineInput[]) {
    const fallback = await this.defaultItemId(orgId, realmId);
    const withIds = lines.map((l) => ({ ...l, itemId: l.itemId || fallback }));
    const taxable = await this.itemTaxableMap(orgId, [...new Set(withIds.map((l) => l.itemId))]);
    return withIds.map((l) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: toQbAmount(l.quantity * l.unitPrice),
      Description: l.description,
      SalesItemLineDetail: {
        ItemRef: { value: l.itemId },
        Qty: l.quantity,
        UnitPrice: toQbAmount(l.unitPrice),
        // Inherit taxability from the item's QuickBooks setting ('TAX' = taxable, so
        // Automated Sales Tax computes the rate; 'NON' = nontaxable).
        TaxCodeRef: { value: taxable.get(l.itemId) ? 'TAX' : 'NON' },
      },
    }));
  }

  private normalizeDoc(doc: any): NormalizedDoc {
    const lines: NormalizedLine[] = (doc.Line ?? [])
      .filter((l: any) => l.DetailType === 'SalesItemLineDetail')
      .map((l: any) => ({
        description: l.Description ?? '',
        quantity: Math.round(Number(l.SalesItemLineDetail?.Qty ?? 1)),
        unitPrice: fromQbAmount(l.SalesItemLineDetail?.UnitPrice),
        amount: fromQbAmount(l.Amount),
        qbLineId: l.Id ?? null,
        itemId: l.SalesItemLineDetail?.ItemRef?.value ?? null,
        itemName: l.SalesItemLineDetail?.ItemRef?.name ?? null,
      }));
    return {
      qbId: doc.Id,
      docNumber: doc.DocNumber ?? null,
      status: doc.TxnStatus ?? null,
      totalAmount: fromQbAmount(doc.TotalAmt),
      balance: fromQbAmount(doc.Balance),
      qbCustomerId: doc.CustomerRef?.value ?? null,
      txnDate: doc.TxnDate ?? null,
      linkedTxns: (doc.LinkedTxn ?? []).map((t: any) => ({ txnId: t.TxnId, txnType: t.TxnType })),
      syncToken: doc.SyncToken,
      lines,
    };
  }

  private async docBody(orgId: string, input: DocInput): Promise<Record<string, unknown>> {
    const { realmId } = await this.authContext(orgId);
    const lines = await this.buildLines(orgId, realmId, input.lines);
    const body: Record<string, unknown> = {
      CustomerRef: { value: input.customerId },
      Line: lines,
    };
    // If any line is taxable, tell QuickBooks to add its Automated Sales Tax on top.
    const anyTaxable = lines.some(
      (l) => (l.SalesItemLineDetail as { TaxCodeRef?: { value?: string } })?.TaxCodeRef?.value === 'TAX',
    );
    if (anyTaxable) body.GlobalTaxCalculation = 'TaxExcluded';
    if (input.txnDate) body.TxnDate = input.txnDate.slice(0, 10);
    if (input.currency && input.currency !== 'USD') body.CurrencyRef = { value: input.currency };
    const bill = toQbAddr(input.billAddr);
    const ship = toQbAddr(input.shipAddr);
    if (bill) body.BillAddr = bill;
    if (ship) body.ShipAddr = ship;
    if (input.privateNote) body.PrivateNote = input.privateNote;
    if (input.memo) body.CustomerMemo = { value: input.memo };
    if (input.linkedTxns?.length) {
      body.LinkedTxn = input.linkedTxns.map((t) => ({ TxnId: t.txnId, TxnType: t.txnType }));
    }
    return body;
  }

  private async createDoc(orgId: string, resource: 'estimate' | 'invoice', input: DocInput): Promise<NormalizedDoc> {
    const body = await this.docBody(orgId, input);
    const r = await this.request(orgId, 'POST', resource, body);
    return this.normalizeDoc(resource === 'estimate' ? r.Estimate : r.Invoice);
  }

  createEstimate(orgId: string, input: DocInput) {
    return this.createDoc(orgId, 'estimate', input);
  }
  createInvoice(orgId: string, input: DocInput) {
    return this.createDoc(orgId, 'invoice', input);
  }

  /** Read the current SyncToken for a doc (for safe sparse updates). */
  private async currentSyncToken(orgId: string, resource: 'Estimate' | 'Invoice', qbId: string): Promise<string | null> {
    const r = await this.query(orgId, `select Id, SyncToken from ${resource} where Id = '${qbId}'`);
    return r?.QueryResponse?.[resource]?.[0]?.SyncToken ?? null;
  }

  /** Replace a doc's lines + addresses (re-reads SyncToken to avoid stale-token errors). */
  private async updateDoc(orgId: string, resource: 'estimate' | 'invoice', qbId: string, input: DocInput): Promise<NormalizedDoc> {
    const Resource = resource === 'estimate' ? 'Estimate' : 'Invoice';
    const syncToken = await this.currentSyncToken(orgId, Resource, qbId);
    if (syncToken == null) throw new BadRequestException('This document no longer exists in QuickBooks');
    const body = await this.docBody(orgId, input);
    body.Id = qbId;
    body.SyncToken = syncToken;
    const r = await this.request(orgId, 'POST', resource, body);
    return this.normalizeDoc(resource === 'estimate' ? r.Estimate : r.Invoice);
  }

  updateEstimate(orgId: string, qbId: string, input: DocInput) {
    return this.updateDoc(orgId, 'estimate', qbId, input);
  }
  updateInvoice(orgId: string, qbId: string, input: DocInput) {
    return this.updateDoc(orgId, 'invoice', qbId, input);
  }

  /** Delete a doc in QuickBooks (re-reads SyncToken; no-op if it's already gone). */
  private async deleteDoc(orgId: string, resource: 'estimate' | 'invoice', qbId: string): Promise<void> {
    const Resource = resource === 'estimate' ? 'Estimate' : 'Invoice';
    const syncToken = await this.currentSyncToken(orgId, Resource, qbId);
    if (syncToken == null) return; // already deleted in QBO
    await this.request(orgId, 'POST', `${resource}?operation=delete`, { Id: qbId, SyncToken: syncToken });
  }

  deleteEstimate(orgId: string, qbId: string) {
    return this.deleteDoc(orgId, 'estimate', qbId);
  }

  /**
   * Void an invoice in QuickBooks (re-reads SyncToken; no-op if it's already gone).
   * QBO's `?operation=void` zeroes the invoice's lines and stamps it "Voided" (keeps the
   * record + doc number for the audit trail), unlike delete which removes it entirely.
   * Returns the new SyncToken so the caller can persist it.
   */
  async voidInvoice(orgId: string, qbId: string): Promise<string | null> {
    const syncToken = await this.currentSyncToken(orgId, 'Invoice', qbId);
    if (syncToken == null) return null; // already gone in QBO
    const r = await this.request(orgId, 'POST', 'invoice?operation=void', { Id: qbId, SyncToken: syncToken });
    return r?.Invoice?.SyncToken ?? null;
  }

  private async listDocs(orgId: string, resource: 'Estimate' | 'Invoice', customerId: string): Promise<NormalizedDoc[]> {
    const r = await this.query(orgId, `select * from ${resource} where CustomerRef = '${customerId}'`);
    return (r?.QueryResponse?.[resource] ?? []).map((d: any) => this.normalizeDoc(d));
  }
  listEstimates(orgId: string, customerId: string) {
    return this.listDocs(orgId, 'Estimate', customerId);
  }
  listInvoices(orgId: string, customerId: string) {
    return this.listDocs(orgId, 'Invoice', customerId);
  }

  /** Fetch a single estimate/invoice by its QBO id (used to re-sync one changed doc from a webhook). */
  private async getDoc(orgId: string, resource: 'Estimate' | 'Invoice', qbId: string): Promise<NormalizedDoc | null> {
    const r = await this.query(orgId, `select * from ${resource} where Id = '${qbId.replace(/'/g, '')}'`);
    const doc = r?.QueryResponse?.[resource]?.[0];
    return doc ? this.normalizeDoc(doc) : null;
  }
  getEstimate(orgId: string, qbId: string) {
    return this.getDoc(orgId, 'Estimate', qbId);
  }
  getInvoice(orgId: string, qbId: string) {
    return this.getDoc(orgId, 'Invoice', qbId);
  }

  /** Reverse-lookup the tenant that owns a QBO company (realmId) — webhooks are keyed by realmId. */
  async orgIdForRealm(realmId: string): Promise<string | null> {
    const conn = await this.prisma.quickBooksConnection.findFirst({
      where: { realmId, status: 'connected' },
      select: { orgId: true },
    });
    return conn?.orgId ?? null;
  }

  /** Fetch the official QuickBooks PDF for an estimate/invoice. */
  async getDocPdf(orgId: string, resource: 'estimate' | 'invoice', qbId: string): Promise<Buffer> {
    const { accessToken, realmId } = await this.authContext(orgId);
    const url = `${this.baseUrl()}/v3/company/${realmId}/${resource}/${qbId}/pdf?minorversion=${MINOR_VERSION}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/pdf' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new BadRequestException(`QuickBooks PDF unavailable (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Email a doc to the customer via QuickBooks (uses the customer's email on file unless `email` is given). */
  async sendDoc(orgId: string, resource: 'estimate' | 'invoice', qbId: string, email?: string): Promise<NormalizedDoc> {
    const path = email ? `${resource}/${qbId}/send?sendTo=${encodeURIComponent(email)}` : `${resource}/${qbId}/send`;
    const r = await this.request(orgId, 'POST', path);
    return this.normalizeDoc(resource === 'estimate' ? r.Estimate : r.Invoice);
  }

  /** Sparse-update an estimate's TxnStatus (Pending|Accepted|Rejected|Closed). */
  async updateEstimateStatus(orgId: string, qbId: string, syncToken: string, txnStatus: string): Promise<NormalizedDoc> {
    const r = await this.request(orgId, 'POST', 'estimate', {
      Id: qbId,
      SyncToken: syncToken,
      sparse: true,
      TxnStatus: txnStatus,
    });
    return this.normalizeDoc(r.Estimate);
  }
}
