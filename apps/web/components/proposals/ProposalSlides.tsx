'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, type ProposalRenderCtx } from './ProposalRenderer';
import { PageSurface } from './PageSurface';

const CSS = `
@keyframes propSlideFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes propSlideIn { from { opacity: 0; transform: translateX(48px) } to { opacity: 1; transform: none } }
@keyframes propElIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
.prop-slide-fade { animation: propSlideFade .45s ease both }
.prop-slide-slide { animation: propSlideIn .45s cubic-bezier(.22,.61,.36,1) both }
.prop-slide-none { }
`;

/**
 * The recipient-facing slide deck: one page per slide. Navigate by swipe, arrow keys, dots or buttons.
 *  - `fill`: size the slide to fit its parent (letterboxed) for full-screen.
 *  - `immersive`: hide all chrome; edge arrows + the `overlay` (e.g. accept/decline) fade in only
 *    while the viewer is interacting (mouse move / touch), then auto-hide.
 *  - `bg`: backdrop color around the page.
 */
export function ProposalSlides({
  pages,
  theme,
  ctx,
  fill = false,
  immersive = false,
  bg,
  overlay,
}: {
  pages: CanvasPage[];
  theme: ProposalTheme;
  ctx: ProposalRenderCtx;
  fill?: boolean;
  immersive?: boolean;
  bg?: string;
  overlay?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const n = pages.length;
  const clamp = (x: number) => Math.max(0, Math.min(n - 1, x));
  const go = (d: number) => setI((x) => clamp(x + d));

  const startX = useRef<number | null>(null);

  const [active, setActive] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const poke = () => {
    setActive(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), 2600);
  };

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
    if (immersive) poke();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive]);

  const page = pages[i];
  const transition = theme.transition ?? 'fade';
  const animate = theme.animate ?? true;

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    if (immersive) poke();
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

  const fitArea = (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={immersive ? poke : undefined}
      style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y', userSelect: 'none', overflow: 'hidden', padding: immersive ? 0 : 4 }}
    >
      <PageSurface orientation={theme.orientation} fit="contain" surfaceStyle={{ boxShadow: '0 8px 40px rgba(0,0,0,0.25)', fontFamily: `${theme.fontBody}, sans-serif`, color: theme.accentColor }}>
        {slide}
      </PageSurface>
    </div>
  );

  // Full-screen (fit-to-parent).
  if (fill) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: bg, position: 'relative' }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {fitArea}
        {!immersive && dots}

        {immersive && n > 1 && (
          <>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', padding: 16, opacity: active ? 1 : 0, transition: 'opacity .3s', pointerEvents: active ? 'auto' : 'none' }}>
              <ActionIcon size="xl" radius="xl" variant="filled" color="dark" disabled={i === 0} onClick={() => go(-1)} aria-label="Previous">
                <IconChevronLeft size={22} />
              </ActionIcon>
            </div>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', padding: 16, opacity: active ? 1 : 0, transition: 'opacity .3s', pointerEvents: active ? 'auto' : 'none' }}>
              <ActionIcon size="xl" radius="xl" variant="filled" color="dark" disabled={i === n - 1} onClick={() => go(1)} aria-label="Next">
                <IconChevronRight size={22} />
              </ActionIcon>
            </div>
          </>
        )}
        {immersive && (overlay || n > 1) && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, opacity: active ? 1 : 0, transition: 'opacity .3s', pointerEvents: active ? 'auto' : 'none' }}>
            {n > 1 && (
              <Group gap={6}>
                {pages.map((p, idx) => (
                  <button key={p.id} onClick={() => setI(idx)} aria-label={`Go to page ${idx + 1}`} style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, background: idx === i ? theme.primaryColor : 'rgba(255,255,255,0.5)' }} />
                ))}
              </Group>
            )}
            {overlay}
          </div>
        )}
      </div>
    );
  }

  // Framed deck (non-fill).
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
        <PageSurface
          orientation={theme.orientation}
          fit="width"
          surfaceStyle={{ borderRadius: 10, boxShadow: '0 10px 34px rgba(0,0,0,0.18)', fontFamily: `${theme.fontBody}, sans-serif`, color: theme.accentColor }}
        >
          {slide}
        </PageSurface>
      </div>
      {dots}
    </div>
  );
}
