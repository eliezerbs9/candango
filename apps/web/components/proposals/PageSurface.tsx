'use client';

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type DragEvent as ReactDragEvent, type ReactNode } from 'react';
import { pageAspectCss, pageDims } from '@/lib/api/proposals';

/**
 * Renders `children` on a fixed reference-size page (pageDims) and uniformly scales it to fit — so
 * fonts, spacing and positions are identical on every surface (editor, preview, presentation,
 * thumbnails). `fit='width'` fills the container width (aspect box); `fit='contain'` letterboxes to
 * fit both dimensions. The forwarded ref points at the scaled surface (its rect reflects the scale,
 * so percent-based pointer math keeps working).
 */
export const PageSurface = forwardRef<
  HTMLDivElement,
  {
    orientation?: string;
    fit?: 'width' | 'contain';
    children: ReactNode;
    surfaceStyle?: CSSProperties;
    onPointerDown?: (e: ReactPointerEvent) => void;
    onDrop?: (e: ReactDragEvent) => void;
    onDragOver?: (e: ReactDragEvent) => void;
  }
>(function PageSurface({ orientation, fit = 'width', children, surfaceStyle, onPointerDown, onDrop, onDragOver }, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w: RW, h: RH } = pageDims(orientation);
  const scale = fit === 'contain' ? (box.w && box.h ? Math.min(box.w / RW, box.h / RH) : 0) : box.w ? box.w / RW : 0;

  const surface = (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: RW,
        height: RH,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        background: '#fff',
        overflow: 'hidden',
        ...surfaceStyle,
      }}
    >
      {scale > 0 && children}
    </div>
  );

  if (fit === 'contain') {
    return (
      <div ref={boxRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: RW * scale, height: RH * scale }}>{surface}</div>
      </div>
    );
  }
  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', aspectRatio: pageAspectCss(orientation) }}>
      {surface}
    </div>
  );
});
