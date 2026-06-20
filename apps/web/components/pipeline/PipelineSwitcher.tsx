'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@mantine/core';
import type { Pipeline } from '@/lib/types';

export function PipelineSwitcher({ pipelines, value }: { pipelines: Pipeline[]; value: string }) {
  const router = useRouter();
  return (
    <Select
      data={pipelines.map((p) => ({ value: p.id, label: p.name }))}
      value={value}
      onChange={(v) => v && router.push(`/pipelines/${v}`)}
      allowDeselect={false}
      w={200}
    />
  );
}
