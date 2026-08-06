'use client';

import { useRef, useState, type RefObject } from 'react';
import { Paper, Portal, Text, TextInput, type TextInputProps } from '@mantine/core';
import { variableTrigger, variableToken } from '@/lib/variableInsert';

type Var = { key: string; label: string };
type Menu = { items: Var[]; index: number; from: number; to: number; bare: boolean; left: number; top: number };

/**
 * A TextInput with the same `{`/`{{` variable autocomplete as the rich-text body — for single-line
 * fields like an email subject. Selecting a variable inserts `{{key}}` at the caret.
 */
export function VariableTextInput({
  value,
  onChange,
  variables,
  inputRef,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  variables: Var[];
  inputRef?: RefObject<HTMLInputElement | null>;
} & Omit<TextInputProps, 'value' | 'onChange'>) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? internalRef;
  const [menu, setMenu] = useState<Menu | null>(null);

  const recompute = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.value;
    const caret = el.selectionStart ?? text.length;
    const trig = variableTrigger(text.slice(0, caret), text.slice(caret));
    if (!trig) return setMenu(null);
    const q = trig.query.toLowerCase();
    const items = variables.filter((v) => v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)).slice(0, 8);
    if (!items.length) return setMenu(null);
    const rect = el.getBoundingClientRect();
    const width = 300;
    const estH = Math.min(items.length, 8) * 40 + 8;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + estH + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - estH - 4);
    setMenu({ items, index: 0, from: trig.from, to: caret, bare: trig.bare, left, top });
  };

  const accept = (v: Var) => {
    if (!menu) return;
    const el = ref.current;
    const cur = el?.value ?? value;
    const token = variableToken(v.key, menu.bare);
    const next = cur.slice(0, menu.from) + token + cur.slice(menu.to);
    onChange(next);
    setMenu(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = menu.from + token.length;
      el?.setSelectionRange(pos, pos);
    });
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
    <>
      <TextInput
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
    </>
  );
}
