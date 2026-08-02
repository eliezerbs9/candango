'use client';

import { useEffect, useState } from 'react';
import { Badge, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { useAllStages, useCompanies, usePersons, usePreviewAudience } from '@/lib/api/hooks';
import type { AudienceType, MarketingAudience } from '@/lib/api/email-automations';

const AUDIENCE_TYPES: { value: AudienceType; label: string }[] = [
  { value: 'all', label: 'All subscribed contacts' },
  { value: 'label', label: 'Contacts with a label' },
  { value: 'deal_stage', label: 'Contacts with a deal in a stage' },
  { value: 'filter', label: 'Custom filter' },
];

/** Builds a marketing audience and shows a live count of how many contacts it currently matches. */
export function AudienceBuilder({
  value,
  onChange,
}: {
  value: MarketingAudience;
  onChange: (a: MarketingAudience) => void;
}) {
  const { data: persons = [] } = usePersons();
  const { data: stages = [] } = useAllStages();
  const { data: companies = [] } = useCompanies();
  const preview = usePreviewAudience();
  const [count, setCount] = useState<number | null>(null);

  const allTags = [...new Set(persons.flatMap((p) => p.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const set = (patch: Partial<MarketingAudience>) => onChange({ ...value, ...patch });

  // Live recipient preview whenever the audience definition changes.
  const key = JSON.stringify(value);
  useEffect(() => {
    let active = true;
    setCount(null);
    if (!isComplete(value)) return;
    preview
      .mutateAsync(value)
      .then((r) => active && setCount(r.count))
      .catch(() => active && setCount(null));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const tagOptions = allTags.map((t) => ({ value: t, label: t }));

  return (
    <Stack gap="sm">
      <Select
        label="Send to"
        data={AUDIENCE_TYPES}
        value={value.type}
        onChange={(v) => onChange({ type: (v as AudienceType) ?? 'all' })}
        allowDeselect={false}
      />

      {value.type === 'label' && (
        <CreatableMultiSelect
          label="With any of these labels"
          placeholder="Pick labels"
          options={tagOptions}
          value={value.tags ?? []}
          onChange={(tags) => set({ tags })}
          onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
          createVerb="Add"
          emptyText="Type to add a label"
        />
      )}

      {value.type === 'deal_stage' && (
        <Select
          label="Deal in this stage"
          placeholder="Pick a stage"
          data={stages.map((s) => ({ value: s.id, label: s.name }))}
          value={value.stageId ?? null}
          onChange={(v) => set({ stageId: v ?? undefined })}
        />
      )}

      {value.type === 'filter' && (
        <>
          <CreatableMultiSelect
            label="Has any of these labels"
            placeholder="Optional"
            options={tagOptions}
            value={value.filter?.tagsAny ?? []}
            onChange={(tagsAny) => set({ filter: { ...value.filter, tagsAny } })}
            onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
            createVerb="Add"
            emptyText="Type to add a label"
          />
          <CreatableMultiSelect
            label="Has all of these labels"
            placeholder="Optional"
            options={tagOptions}
            value={value.filter?.tagsAll ?? []}
            onChange={(tagsAll) => set({ filter: { ...value.filter, tagsAll } })}
            onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
            createVerb="Add"
            emptyText="Type to add a label"
          />
          <Select
            label="At this company"
            placeholder="Optional"
            clearable
            data={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={value.filter?.companyId ?? null}
            onChange={(v) => set({ filter: { ...value.filter, companyId: v ?? undefined } })}
          />
        </>
      )}

      <Group gap={6}>
        <IconUsers size={16} />
        {count === null && preview.isPending ? (
          <Loader size="xs" />
        ) : count === null ? (
          <Text size="sm" c="dimmed">
            Define the audience to preview its size.
          </Text>
        ) : (
          <Text size="sm">
            <Badge variant="light" color="candango">
              {count}
            </Badge>{' '}
            subscribed contact{count === 1 ? '' : 's'} will receive this.
          </Text>
        )}
      </Group>
    </Stack>
  );
}

/** Whether an audience is complete enough to resolve (mirrors the API validation). */
function isComplete(a: MarketingAudience): boolean {
  if (a.type === 'all') return true;
  if (a.type === 'label') return !!a.tags?.length;
  if (a.type === 'deal_stage') return !!a.stageId;
  if (a.type === 'filter') return !!(a.filter?.tagsAny?.length || a.filter?.tagsAll?.length || a.filter?.companyId);
  return false;
}
