'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  CloseButton,
  Combobox,
  Group,
  InputBase,
  Loader,
  Text,
  useCombobox,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export interface Option {
  value: string;
  label: string;
  /** Secondary dimmed text shown under the label (e.g. a person's company), also searchable. */
  description?: string;
}

/**
 * A select you type directly into: it filters existing options as you type,
 * and when nothing matches the typed text it offers "+ Create '<text>'".
 * Picking that calls `onCreate`, which returns the new option — selected
 * immediately, without leaving the form. There is no separate search box;
 * the field itself is the input.
 */
export function CreatableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  onCreate,
  disabled,
  description,
  openOnFocus,
}: {
  label: string;
  placeholder?: string;
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  onCreate: (name: string) => Promise<Option | null>;
  disabled?: boolean;
  description?: ReactNode;
  /** Show the full option list on focus/click (for small curated lists), not only while typing. */
  openOnFocus?: boolean;
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [creating, setCreating] = useState(false);
  // Locally-created options live here so they show instantly, before the list refetches.
  const [extra, setExtra] = useState<Option[]>([]);

  const all = [...options, ...extra.filter((e) => !options.some((o) => o.value === e.value))];
  const selectedLabel = all.find((o) => o.value === value)?.label ?? '';

  // The field shows the typed text while searching, and the selected label otherwise.
  const [search, setSearch] = useState(selectedLabel);
  useEffect(() => {
    setSearch(selectedLabel);
  }, [selectedLabel]);

  const query = search.trim();
  const q = query.toLowerCase();
  // Suggestions: filtered by the typed text (name + description). With `openOnFocus`, the full list
  // shows on focus (small curated lists); otherwise nothing until the user types (large lists).
  const filtered = query
    ? all.filter((o) => o.label.toLowerCase().includes(q) || (o.description ?? '').toLowerCase().includes(q))
    : openOnFocus
      ? all
      : [];
  const exactMatch = all.some((o) => o.label.toLowerCase() === q);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await onCreate(query);
      if (!created) return; // creation cancelled
      setExtra((prev) => [...prev, created]);
      onChange(created.value);
      setSearch(created.label);
      combobox.closeDropdown();
    } finally {
      setCreating(false);
    }
  }

  const optionNodes = filtered.map((o) => (
    <Combobox.Option value={o.value} key={o.value}>
      <Text size="sm">{o.label}</Text>
      {o.description ? (
        <Text size="xs" c="dimmed">
          {o.description}
        </Text>
      ) : null}
    </Combobox.Option>
  ));

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '$create') {
          void handleCreate();
          return;
        }
        const opt = all.find((o) => o.value === val);
        onChange(val);
        setSearch(opt?.label ?? '');
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          label={label}
          placeholder={placeholder}
          description={description}
          value={search}
          disabled={disabled}
          rightSection={
            creating ? (
              <Loader size="xs" />
            ) : value && !disabled ? (
              <CloseButton
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(null);
                  setSearch('');
                }}
                aria-label="Clear"
              />
            ) : (
              <Combobox.Chevron />
            )
          }
          rightSectionPointerEvents={value && !creating && !disabled ? 'all' : 'none'}
          onChange={(e) => {
            if (disabled) return;
            const v = e.currentTarget.value;
            setSearch(v);
            // Reveal suggestions once there's typed text (or always, with openOnFocus).
            if (v.trim() || openOnFocus) {
              combobox.openDropdown();
              combobox.updateSelectedOptionIndex();
            } else {
              combobox.closeDropdown();
            }
          }}
          // Focus clears the field so the user types to search; with openOnFocus, also show the list.
          onFocus={() => {
            if (disabled) return;
            setSearch('');
            if (openOnFocus) combobox.openDropdown();
          }}
          onClick={() => openOnFocus && !disabled && combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch(selectedLabel);
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {optionNodes.length > 0 ? optionNodes : null}
          {query && !exactMatch ? (
            <Combobox.Option value="$create">
              <Group gap={6} wrap="nowrap">
                <IconPlus size={14} />
                <Text size="sm">
                  Create “<b>{query}</b>”
                </Text>
              </Group>
            </Combobox.Option>
          ) : null}
          {optionNodes.length === 0 && !query ? (
            <Combobox.Empty>Type to search or create</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
