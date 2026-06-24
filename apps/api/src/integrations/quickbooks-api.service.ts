import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OAuthClient from 'intuit-oauth';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken, encryptToken } from './crypto.util';

const MINOR_VERSION = '73';
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Our deal address Json → QBO address shape (undefined if empty). */
type Addr = Record<string, string> | null | undefined;
function toQbAddr(a: Addr) {
  const x = (a ?? {}) as Record<string, string>;
  const out: Record<string, string> = {};
  if (x.line1) out.Line1 = x.line1;
  if (x.line2) out.Line2 = x.line2;
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
}
export interface NormalizedDoc {
  qbId: string;
  docNumber: string | null;
  status: string | null;
  totalAmount: number; // minor units (QBO TotalAmt — source of truth incl. tax)
  syncToken: string;
  lines: { description: string; quantity: number; unitPrice: number; amount: number; qbLineId: string | null }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Low-level QuickBooks Online Accounting API client with refresh-on-use. One connection per org. */
@Injectable()
export class QuickbooksApiService {
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
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.Fault?.Error?.[0]?.Detail ?? json?.Fault?.Error?.[0]?.Message ?? `QBO error ${res.status}`;
      throw new BadRequestException(`QuickBooks: ${msg}`);
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

  // --- Estimates / Invoices ---
  private async buildLines(orgId: string, realmId: string, lines: LineInput[]) {
    const itemId = await this.defaultItemId(orgId, realmId);
    return lines.map((l) => ({
      DetailType: 'SalesItemLineDetail',
      Amount: toQbAmount(l.quantity * l.unitPrice),
      Description: l.description,
      SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: l.quantity, UnitPrice: toQbAmount(l.unitPrice) },
    }));
  }

  private normalizeDoc(doc: any): NormalizedDoc {
    const lines = (doc.Line ?? [])
      .filter((l: any) => l.DetailType === 'SalesItemLineDetail')
      .map((l: any) => ({
        description: l.Description ?? '',
        quantity: Math.round(Number(l.SalesItemLineDetail?.Qty ?? 1)),
        unitPrice: fromQbAmount(l.SalesItemLineDetail?.UnitPrice),
        amount: fromQbAmount(l.Amount),
        qbLineId: l.Id ?? null,
      }));
    return {
      qbId: doc.Id,
      docNumber: doc.DocNumber ?? null,
      status: doc.TxnStatus ?? null,
      totalAmount: fromQbAmount(doc.TotalAmt),
      syncToken: doc.SyncToken,
      lines,
    };
  }

  private async createDoc(orgId: string, resource: 'estimate' | 'invoice', input: { customerId: string; currency?: string; txnDate?: string; lines: LineInput[] }): Promise<NormalizedDoc> {
    const { realmId } = await this.authContext(orgId);
    const body: Record<string, unknown> = {
      CustomerRef: { value: input.customerId },
      Line: await this.buildLines(orgId, realmId, input.lines),
    };
    if (input.txnDate) body.TxnDate = input.txnDate.slice(0, 10);
    if (input.currency && input.currency !== 'USD') body.CurrencyRef = { value: input.currency };
    const r = await this.request(orgId, 'POST', resource, body);
    return this.normalizeDoc(resource === 'estimate' ? r.Estimate : r.Invoice);
  }

  createEstimate(orgId: string, input: { customerId: string; currency?: string; txnDate?: string; lines: LineInput[] }) {
    return this.createDoc(orgId, 'estimate', input);
  }
  createInvoice(orgId: string, input: { customerId: string; currency?: string; txnDate?: string; lines: LineInput[] }) {
    return this.createDoc(orgId, 'invoice', input);
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
