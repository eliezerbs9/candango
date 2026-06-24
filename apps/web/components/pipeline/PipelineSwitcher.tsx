'use client';

import { Select } from '@mantine/core';
import type { ApiPipeline } from '@/lib/api/types';

export function PipelineSwitcher({
  pipelines,
  value,
  onChange,
}: {
  pipelines: ApiPipeline[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Select
      data={pipelines.map((p) => ({ value: p.id, label: p.name }))}
      value={value}
      onChange={(v) => v && onChange(v)}
      allowDeselect={false}
      w={200}
    />
  );
}
