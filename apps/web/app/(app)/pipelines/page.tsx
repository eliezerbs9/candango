'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader, Text } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { usePipelines } from '@/lib/api/hooks';

export default function PipelinesIndex() {
  const router = useRouter();
  const { data: pipelines, isLoading } = usePipelines();

  useEffect(() => {
    if (pipelines && pipelines.length > 0) {
      const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
      router.replace(`/pipelines/${def.id}`);
    }
  }, [pipelines, router]);

  if (isLoading || (pipelines && pipelines.length > 0)) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <PageHeader title="Pipelines" subtitle="Drag deals between stages" />
      <Text c="dimmed">No pipelines yet. (Pipeline creation UI comes in a later step.)</Text>
    </>
  );
}
