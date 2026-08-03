'use client';

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, type ProposalRenderCtx } from './ProposalRenderer';

const CSS = `
@keyframes propSlideFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes propSlideIn { from { opacity: 0; transform: translateX(48px) } to { opacity: 1; transform: none } }
@keyframes propElIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.prop-slide-fade { animation: propSlideFade .45s ease both }
.prop-slide-slide { animation: propSlideIn .45s cubic-bezier(.22,.61,.36,1) both }
.prop-slide-none { }
`;

/**
 * The recipient-facing slide deck: one page per slide, with a page transition and (optionally)
 * staggered element entrance animations. Navigate by swipe (touch), arrow keys, dots or buttons.
 * In `fill` mode the slide is sized to fit its parent (letterboxed) for a full-screen presentation.
 */
export function ProposalSlides({
  pages,
  theme,
  ctx,
  fill = false,
}: {
  pages: CanvasPage[];
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
  fill?: boolean;
}) {
  const [i, setI] = useState(0);
  const n = pages.length;
  const clamp = (x: number) => Math.max(0, Math.min(n - 1, x));
  const go = (d: number) => setI((x) => clamp(x + d));

  const fitRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    const el = fitRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const page = pages[i];
  const transition = theme.transition ?? 'fade';
  const animate = theme.animate ?? true;
  const landscape = theme.orientation === 'landscape';
  const ratio = landscape ? 11 / 8.5 : 8.5 / 11; // width / height

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  const slide = (
    <div key={i} className={`prop-slide-${transition}`} style={{ position: 'absolute', inset: 0 }}>
      {page?.elements.map((el, idx) => (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.w}%`,
            height: `${el.h}%`,
            animation: animate ? 'propElIn .5s ease both' : undefined,
            animationDelay: animate ? `${Math.min(idx * 70, 600)}ms` : undefined,
          }}
        >
          <ElementView element={el} theme={theme} ctx={ctx} />
        </div>
      ))}
    </div>
  );

  const dots = n > 1 && (
    <Group justify="center" gap="sm" py="sm">
      <ActionIcon variant="subtle" radius="xl" size="lg" disabled={i === 0} onClick={() => go(-1)} aria-label="Previous">
        <IconChevronLeft size={18} />
      </ActionIcon>
      <Group gap={6}>
        {pages.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => setI(idx)}
            aria-label={`Go to page ${idx + 1}`}
            style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: idx === i ? theme.primaryColor : 'var(--mantine-color-gray-4)' }}
          />
        ))}
      </Group>
      <ActionIcon variant="subtle" radius="xl" size="lg" disabled={i === n - 1} onClick={() => go(1)} aria-label="Next">
        <IconChevronRight size={18} />
      </ActionIcon>
    </Group>
  );

  // Full-screen: fit the page inside the available area, letterboxed.
  if (fill) {
    let w = box.w;
    let h = w / ratio;
    if (h > box.h) {
      h = box.h;
      w = h * ratio;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div
          ref={fitRef}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y', userSelect: 'none', overflow: 'hidden' }}
        >
          {box.w > 0 && (
            <div style={{ position: 'relative', width: w, height: h, background: '#fff', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', fontFamily: `${theme.fontBody}, sans-serif`, color: theme.accentColor }}>
              {slide}
            </div>
          )}
        </div>
        {dots}
      </div>
    );
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: landscape ? '11 / 8.5' : '8.5 / 11',
          background: '#fff',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 10px 34px rgba(0,0,0,0.18)',
          fontFamily: `${theme.fontBody}, sans-serif`,
          color: theme.accentColor,
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
      >
        {slide}
      </div>
      {dots}
    </div>
  );
}
