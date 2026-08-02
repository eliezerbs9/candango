'use client';

import { useEffect, useRef, useState } from 'react';
import { Paper, Portal, Text } from '@mantine/core';
import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export interface EditorVariable {
  key: string;
  label: string;
  group?: string;
}

interface Menu {
  items: EditorVariable[];
  index: number;
  from: number;
  to: number;
  left: number;
  top: number;
}

/** A Mantine + Tiptap rich-text editor that emits HTML — used for composing emails. */
export function RichTextBody({
  value,
  onChange,
  minHeight = 220,
  onReady,
  variables,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  /** Receives the editor instance (e.g. to insert content at the caret). */
  onReady?: (editor: Editor | null) => void;
  /** When provided, typing `{` opens an autocomplete of these {{variables}}. */
  variables?: EditorVariable[];
}) {
  const [menu, setMenu] = useState<Menu | null>(null);
  // handleKeyDown (bound at editor creation) reads live menu state + actions through this ref.
  const nav = useRef<{ menu: Menu | null; move: (d: number) => void; accept: () => void; close: () => void }>({
    menu: null,
    move: () => {},
    accept: () => {},
    close: () => {},
  });

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handleKeyDown: (_view, event) => {
        const m = nav.current.menu;
        if (!m || m.items.length === 0) return false;
        if (event.key === 'ArrowDown') {
          nav.current.move(1);
          return true;
        }
        if (event.key === 'ArrowUp') {
          nav.current.move(-1);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          nav.current.accept();
          return true;
        }
        if (event.key === 'Escape') {
          nav.current.close();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    onReady?.(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Keep the editor in sync when the value is reset externally (e.g. modal reopened).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Variable autocomplete: watch the text before the caret for a `{`/`{{` + partial key.
  useEffect(() => {
    if (!editor || !variables?.length) return;
    const recompute = () => {
      const { state } = editor;
      const sel = state.selection;
      if (!sel.empty) return setMenu(null);
      const $from = sel.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
      const match = /\{{1,2}([\w.]*)$/.exec(textBefore);
      if (!match) return setMenu(null);
      const query = match[1].toLowerCase();
      const items = variables
        .filter((v) => v.key.toLowerCase().includes(query) || v.label.toLowerCase().includes(query))
        .slice(0, 8);
      if (items.length === 0) return setMenu(null);
      const to = sel.from;
      const from = to - match[0].length;
      const coords = editor.view.coordsAtPos(to);
      setMenu((prev) => ({ items, index: prev && prev.from === from ? Math.min(prev.index, items.length - 1) : 0, from, to, left: coords.left, top: coords.bottom }));
    };
    editor.on('update', recompute);
    editor.on('selectionUpdate', recompute);
    return () => {
      editor.off('update', recompute);
      editor.off('selectionUpdate', recompute);
    };
  }, [editor, variables]);

  const accept = (item: EditorVariable) => {
    if (!editor || !menu) return;
    editor.chain().focus().insertContentAt({ from: menu.from, to: menu.to }, `{{${item.key}}}`).run();
    setMenu(null);
  };

  // Wire the ref used by handleKeyDown to the current menu + actions.
  nav.current = {
    menu,
    move: (d) => setMenu((m) => (m ? { ...m, index: (m.index + d + m.items.length) % m.items.length } : m)),
    accept: () => {
      if (menu) accept(menu.items[menu.index]);
    },
    close: () => setMenu(null),
  };

  return (
    <>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar sticky stickyOffset={0}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 />
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Blockquote />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content style={{ minHeight }} />
      </RichTextEditor>

      {menu && (
        <Portal>
          <Paper
            withBorder
            shadow="md"
            radius="sm"
            p={4}
            style={{ position: 'fixed', left: menu.left, top: menu.top + 4, zIndex: 400, minWidth: 220, maxWidth: 300 }}
          >
            {menu.items.map((v, i) => (
              <div
                key={v.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(v);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: i === menu.index ? 'var(--mantine-color-candango-light)' : 'transparent',
                }}
              >
                <Text size="sm">{v.label}</Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {`{{${v.key}}}`}
                </Text>
              </div>
            ))}
          </Paper>
        </Portal>
      )}
    </>
  );
}
