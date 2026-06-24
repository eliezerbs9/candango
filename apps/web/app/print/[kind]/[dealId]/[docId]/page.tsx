'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDeal, useDealEstimates, useDealInvoices } from '@/lib/api/hooks';
import type { DealDoc } from '@/lib/api/types';

function money(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v / 100);
}

function Address({ label, addr }: { label: string; addr: Record<string, unknown> | null | undefined }) {
  const a = (addr ?? {}) as Record<string, string>;
  const lines = [a.name, a.line1, a.line2, [a.city, a.state, a.postalCode].filter(Boolean).join(', '), a.country].filter(Boolean);
  if (!lines.length) return null;
  return (
    <div>
      <div className="muted">{label}</div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

export default function PrintDocPage() {
  const params = useParams<{ kind: string; dealId: string; docId: string }>();
  const kind = params.kind === 'invoice' ? 'invoice' : 'estimate';
  const dealId = params.dealId;
  const docId = params.docId;

  const { data: deal } = useDeal(dealId);
  const estimates = useDealEstimates(dealId);
  const invoices = useDealInvoices(dealId);
  const docs: DealDoc[] | undefined = kind === 'invoice' ? invoices.data : estimates.data;
  const doc = docs?.find((d) => d.id === docId);

  useEffect(() => {
    if (deal && doc) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [deal, doc]);

  if (!deal || !doc) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>Loading…</div>;

  const title = kind === 'invoice' ? 'INVOICE' : 'ESTIMATE';

  return (
    <div className="sheet">
      <style>{`
        body { background: #fff; }
        .sheet { max-width: 720px; margin: 0 auto; padding: 48px; color: #111; font-family: Inter, Arial, sans-serif; font-size: 13px; }
        .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
        h1 { font-size: 26px; margin: 0; letter-spacing: 1px; }
        .muted { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th { text-align: left; border-bottom: 2px solid #111; padding: 6px 4px; font-size: 11px; text-transform: uppercase; color: #444; }
        td { padding: 8px 4px; border-bottom: 1px solid #eee; vertical-align: top; }
        .num { text-align: right; white-space: nowrap; }
        .total { margin-top: 16px; text-align: right; font-size: 16px; font-weight: 700; }
        .addrs { display: flex; gap: 48px; margin-top: 24px; }
        .memo { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; color: #333; white-space: pre-wrap; }
        .toolbar { margin-bottom: 16px; }
        @media print { .toolbar { display: none; } .sheet { padding: 0; } }
      `}</style>

      <div className="toolbar">
        <button onClick={() => window.print()}>Print</button>
      </div>

      <div className="row">
        <div>
          <h1>{title}</h1>
          <div style={{ marginTop: 4 }}>{doc.docNumber ? `#${doc.docNumber}` : '(draft)'} · {doc.status}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted">Deal</div>
          <div style={{ fontWeight: 600 }}>{deal.refNumber != null ? `#${deal.refNumber} · ` : ''}{deal.title}</div>
          <div style={{ marginTop: 6 }} className="muted">Date</div>
          <div>{new Date(doc.txnDate ?? doc.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="addrs">
        <Address label="Bill To" addr={deal.billTo} />
        <Address label="Ship To" addr={deal.shipTo} />
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Unit price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l) => (
            <tr key={l.id}>
              <td>
                {l.description}
                {l.itemName ? <div className="muted" style={{ textTransform: 'none' }}>{l.itemName}</div> : null}
              </td>
              <td className="num">{l.quantity}</td>
              <td className="num">{money(l.unitPrice, doc.currency)}</td>
              <td className="num">{money(l.amount, doc.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="total">Total: {money(doc.totalAmount, doc.currency)}</div>

      {doc.notes && (
        <div className="memo">
          <div className="muted">Memo</div>
          {doc.notes}
        </div>
      )}
    </div>
  );
}
