'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader } from '@mantine/core';

// Per-pipeline board lives in the unified Deals screen (Pipeline view) now.
export default function PipelinePageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/deals');
  }, [router]);
  return (
    <Center mih="60vh">
      <Loader />
    </Center>
  );
}
