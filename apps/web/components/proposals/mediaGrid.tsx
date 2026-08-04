import type { ReactNode } from 'react';

/**
 * A uniform cols × rows image grid that fills the element box. Cells are equal (explicit grid rows),
 * images crop to fill (object-fit: cover), so differing image sizes never break the layout.
 */
export function imageGrid(cols: number, slots: number, urlAt: (i: number) => string | undefined, placeholder?: ReactNode) {
  const c = Math.max(1, cols);
  const n = Math.max(1, slots);
  const rows = Math.max(1, Math.ceil(n / c));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 8, width: '100%', height: '100%' }}>
      {Array.from({ length: n }).map((_, i) => {
        const url = urlAt(i);
        return (
          <div key={i} style={{ overflow: 'hidden', borderRadius: 8, background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#868e96', fontSize: 12 }}>
            {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : placeholder}
          </div>
        );
      })}
    </div>
  );
}
