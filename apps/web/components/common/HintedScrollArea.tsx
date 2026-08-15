'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

/**
 * A ScrollArea that signals when the content continues below the fold: an inset
 * orange shadow at the base plus a clickable chevron pill that scrolls down.
 *
 * - `fill`: the area fills its parent's leftover height (parent must constrain
 *   height); its content is absolutely positioned so it never grows the row.
 * - otherwise it autosizes up to `mah` (default 320px).
 */
export function HintedScrollArea({
  children,
  fill,
  mah = 320,
}: {
  children: React.ReactNode;
  fill?: boolean;
  mah?: number | string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const recompute = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setMore(scrollTop + clientHeight < scrollHeight - 4);
  }, []);

  useEffect(() => {
    recompute();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);
    return () => ro.disconnect();
  }, [recompute]);

  const scrollDown = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollBy({ top: Math.round(el.clientHeight * 0.75), behavior: 'smooth' });
  }, []);

  const scroller = fill ? (
    <ScrollArea
      type="hover"
      offsetScrollbars
      viewportRef={viewportRef}
      onScrollPositionChange={recompute}
      style={{ position: 'absolute', inset: 0 }}
    >
      {children}
    </ScrollArea>
  ) : (
    <ScrollArea.Autosize
      mah={mah}
      type="hover"
      offsetScrollbars
      viewportRef={viewportRef}
      onScrollPositionChange={recompute}
    >
      {children}
    </ScrollArea.Autosize>
  );

  const hint = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: more ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--mantine-radius-md)',
          boxShadow: 'inset 0 -34px 22px -22px var(--mantine-color-candango-light)',
        }}
      />
      <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          aria-label="Scroll down"
          onClick={scrollDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            padding: 0,
            borderRadius: '50%',
            background: 'var(--mantine-color-body)',
            border: '1px solid var(--mantine-color-candango-3)',
            boxShadow: 'var(--mantine-shadow-sm)',
            color: 'var(--mantine-color-candango-6)',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          <IconChevronDown size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={fill ? { position: 'relative', flex: 1, minHeight: 0 } : { position: 'relative' }}>
      {scroller}
      {hint}
    </div>
  );
}
