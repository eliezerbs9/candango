'use client';

import { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@/lib/theme/theme';
import { makeQueryClient } from '@/lib/query/queryClient';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <Notifications position="top-right" />
        {children}
      </QueryClientProvider>
    </MantineProvider>
  );
}
