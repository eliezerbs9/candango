import type { ProposalRenderCtx } from './ProposalRenderer';

/** A render context that fills a template with example data — for the settings preview (no real deal). */
export function buildPreviewCtx(exampleByKey: Record<string, string>): ProposalRenderCtx {
  const resolveText = (s: string) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => exampleByKey[k] ?? k);

  const box = (label: string): React.ReactNode => (
    <div
      style={{
        flex: 1,
        height: 120,
        background: '#e9ecef',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#868e96',
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );

  return {
    resolveText,
    image: () => <div style={{ display: 'flex', gap: 8 }}>{[0, 1, 2].map((i) => <span key={i} style={{ flex: 1 }}>{box('Photo')}</span>)}</div>,
    document: () => (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #dee2e6', borderRadius: 8, padding: '8px 12px' }}>
        <span style={{ color: '#e03131', fontWeight: 700 }}>PDF</span>
        <span style={{ fontSize: 13 }}>Document.pdf</span>
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
