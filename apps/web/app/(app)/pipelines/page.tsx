'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Center, Loader } from '@mantine/core';

// Pipelines were merged into the unified Deals screen (List / Pipeline views).
export default function PipelinesIndex() {
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
