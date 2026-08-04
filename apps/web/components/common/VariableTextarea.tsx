'use client';

import { useRef, useState, type RefObject } from 'react';
import { Paper, Portal, Text, Textarea, type TextareaProps } from '@mantine/core';
import { VariablePalette, type PaletteVariable } from './VariablePalette';

type Menu = { items: PaletteVariable[]; index: number; from: number; to: number; left: number; top: number };

/**
 * A multi-line Textarea with the same `{`/`{{` variable autocomplete as {@link VariableTextInput},
 * plus an orange click-to-insert {@link VariablePalette} below. The one reusable field for any
 * multi-line, variable-aware text (acceptance wording, generated-document HTML, …).
 */
export function VariableTextarea({
  value,
  onChange,
  variables,
  showPalette = true,
  paletteLabel,
  inputRef,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  variables: PaletteVariable[];
  showPalette?: boolean;
  paletteLabel?: string | null;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
} & Omit<TextareaProps, 'value' | 'onChange'>) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? internalRef;
  const [menu, setMenu] = useState<Menu | null>(null);

  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.value;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const m = /\{{1,2}([\w.]*)$/.exec(before);
    if (!m) return setMenu(null);
    const q = m[1].toLowerCase();
    const items = variables.filter((v) => v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)).slice(0, 8);
    if (!items.length) return setMenu(null);
    const rect = el.getBoundingClientRect();
    const width = 300;
    const estH = Math.min(items.length, 8) * 40 + 8;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + estH + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - estH - 4);
    setMenu({ items, index: 0, from: caret - m[0].length, to: caret, left, top });
  };

  const replaceRange = (from: number, to: number, key: string) => {
    const el = ref.current;
    const cur = el?.value ?? value;
    const token = `{{${key}}}`;
    onChange(cur.slice(0, from) + token + cur.slice(to));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = from + token.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const accept = (v: PaletteVariable) => {
    if (!menu) return;
    replaceRange(menu.from, menu.to, v.key);
    setMenu(null);
  };

  const insertAtCaret = (key: string) => {
    const el = ref.current;
    const cur = el?.value ?? value;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    replaceRange(start, end, key);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!menu) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenu((mm) => (mm ? { ...mm, index: (mm.index + 1) % mm.items.length } : mm));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenu((mm) => (mm ? { ...mm, index: (mm.index - 1 + mm.items.length) % mm.items.length } : mm));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      accept(menu.items[menu.index]);
    } else if (e.key === 'Escape') {
      setMenu(null);
    }
  };

  return (
    <div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyUp={recompute}
        onClick={recompute}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMenu(null), 120)}
        {...props}
      />
      {menu && (
        <Portal>
          <Paper withBorder shadow="md" radius="sm" p={4} style={{ position: 'fixed', left: menu.left, top: menu.top, zIndex: 400, minWidth: 220, maxWidth: 300 }}>
            {menu.items.map((v, i) => (
              <div
                key={v.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(v);
                }}
                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', background: i === menu.index ? 'var(--mantine-color-gray-1)' : undefined }}
              >
                <Text size="sm" fw={500}>
                  {v.label}
                </Text>
                <Text size="xs" c="dimmed">{`{{${v.key}}}`}</Text>
              </div>
            ))}
          </Paper>
        </Portal>
      )}
      {showPalette && <VariablePalette variables={variables} onInsert={insertAtCaret} label={paletteLabel} />}
    </div>
  );
}
