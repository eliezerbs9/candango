import type { ProposalRenderData } from '@/lib/api/proposals';
import type { ProposalRenderCtx } from './ProposalRenderer';

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100);

/** A render context backed by a proposal's resolved deal data (variables, signed URLs, pricing). */
export function buildDealCtx(data: ProposalRenderData): ProposalRenderCtx {
  const resolveText = (s: string) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => data.variables[k] ?? '');

  return {
    resolveText,
    image: ({ fieldKey, cols = 1, count = 1 }) => {
      const urls = fieldKey ? data.imagesByField[fieldKey] ?? [] : Object.values(data.imagesByField).flat();
      const c = Math.max(1, cols);
      const slots = Math.max(1, count);
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${c}, 1fr)`,
            gridAutoRows: '1fr',
            gap: 8,
            width: '100%',
            height: '100%',
          }}
        >
          {Array.from({ length: slots }).map((_, i) =>
            urls[i] ? (
              <img key={i} src={urls[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <div key={i} style={{ background: '#e9ecef', borderRadius: 8, minHeight: 48 }} />
            ),
          )}
        </div>
      );
    },
    document: ({ fieldKey }) => {
      const docs = fieldKey ? data.documentsByField[fieldKey] ?? [] : Object.values(data.documentsByField).flat();
      if (docs.length === 0) return null;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map((d, i) => (
            <a
              key={i}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #dee2e6', borderRadius: 8, padding: '8px 12px', textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ color: '#e03131', fontWeight: 700 }}>PDF</span>
              <span style={{ fontSize: 13 }}>{d.name}</span>
            </a>
          ))}
        </div>
      );
    },
    pricing: () => {
      const { rows, total, currency } = data.pricing;
      if (rows.length === 0 && total === 0) return <div style={{ color: '#868e96', fontSize: 13 }}>No estimate selected.</div>;
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '6px 4px' }}>Item</th>
              <th style={{ padding: '6px 4px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f3f5' }}>
                <td style={{ padding: '6px 4px' }}>{r.description}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right' }}>{money(r.amount, currency)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '8px 4px', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{money(total, currency)}</td>
            </tr>
          </tbody>
        </table>
      );
    },
  };
}
