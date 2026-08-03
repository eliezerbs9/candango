'use client';

import { useEffect, useState } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ElementView, type ProposalRenderCtx } from './ProposalRenderer';

const aspect = (o?: string) => (o === 'landscape' ? '11 / 8.5' : '8.5 / 11');

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
 * staggered element entrance animations. Prev/Next via buttons, dots, or the arrow keys.
 */
export function ProposalSlides({ pages, theme, ctx }: { pages: CanvasPage[]; theme: ProposalTheme; ctx: ProposalRenderCtx }) {
  const [i, setI] = useState(0);
  const n = pages.length;
  const clamp = (x: number) => Math.max(0, Math.min(n - 1, x));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setI((x) => clamp(x + 1));
      if (e.key === 'ArrowLeft') setI((x) => clamp(x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const page = pages[i];
  const transition = theme.transition ?? 'fade';
  const animate = theme.animate ?? true;

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: aspect(theme.orientation),
          background: '#fff',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 10px 34px rgba(0,0,0,0.18)',
          fontFamily: `${theme.fontBody}, sans-serif`,
          color: theme.accentColor,
        }}
      >
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
      </div>

      {n > 1 && (
        <Group justify="center" gap="sm" mt="md">
          <ActionIcon variant="default" radius="xl" size="lg" disabled={i === 0} onClick={() => setI((x) => clamp(x - 1))} aria-label="Previous">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Group gap={6}>
            {pages.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setI(idx)}
                aria-label={`Go to page ${idx + 1}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  background: idx === i ? theme.primaryColor : 'var(--mantine-color-gray-4)',
                }}
              />
            ))}
          </Group>
          <ActionIcon variant="default" radius="xl" size="lg" disabled={i === n - 1} onClick={() => setI((x) => clamp(x + 1))} aria-label="Next">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      )}
    </div>
  );
}
