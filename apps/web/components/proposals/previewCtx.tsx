import type { ProposalRenderCtx } from './ProposalRenderer';

/**
 * A render context that fills a template with example data — for the settings preview (no real deal).
 * `fileUrlByKey` resolves template-owned uploaded files (image/document "fixed" source).
 */
export function buildPreviewCtx(exampleByKey: Record<string, string>, fileUrlByKey: Record<string, string> = {}, logoUrl?: string | null): ProposalRenderCtx {
  const today = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date());
  const resolveText = (s: string) =>
    s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => (k === 'date.today' ? today : exampleByKey[k] ?? k));

  return {
    resolveText,
    fileUrl: (key: string) => fileUrlByKey[key],
    image: ({ cols = 1, count = 1, urls }) => {
      const c = Math.max(1, cols);
      const n = urls ? Math.max(1, urls.length) : Math.max(1, count);
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
          {Array.from({ length: n }).map((_, i) =>
            urls?.[i] ? (
              <img key={i} src={urls[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <div
                key={i}
                style={{
                  background: '#e9ecef',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#868e96',
                  fontSize: 12,
                  minHeight: 48,
                }}
              >
                Photo
              </div>
            ),
          )}
        </div>
      );
    },
    document: ({ docs } = {}) => {
      const list = docs && docs.length ? docs : [{ name: 'Document.pdf', url: '' }];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((d, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #dee2e6', borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ color: '#e03131', fontWeight: 700 }}>PDF</span>
              <span style={{ fontSize: 13 }}>{d.name ?? 'Document.pdf'}</span>
            </div>
          ))}
        </div>
      );
    },
    logo: ({ fit = 'contain' } = {}) =>
      logoUrl ? (
        <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} />
      ) : (
        <div style={{ width: '100%', height: '100%', minHeight: 40, background: '#e9ecef', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#868e96', fontSize: 12 }}>
          Logo
        </div>
      ),
    pricing: () => (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '6px 4px' }}>Item</th>
            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #f1f3f5' }}>
            <td style={{ padding: '6px 4px' }}>Labor</td>
            <td style={{ padding: '6px 4px', textAlign: 'right' }}>$3,000.00</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #f1f3f5' }}>
            <td style={{ padding: '6px 4px' }}>Materials</td>
            <td style={{ padding: '6px 4px', textAlign: 'right' }}>$2,000.00</td>
          </tr>
          <tr>
            <td style={{ padding: '8px 4px', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>$5,000.00</td>
          </tr>
        </tbody>
      </table>
    ),
  };
}
