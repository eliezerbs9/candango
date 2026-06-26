'use client';

import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { HeaderBar } from './HeaderBar';
import { NavBar } from './NavBar';
import { TrialBanner } from './TrialBanner';
import { useEmailNotifications } from '@/lib/hooks/useEmailNotifications';

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  useEmailNotifications(); // global "new email" toasts while Gmail is connected

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <HeaderBar opened={opened} onBurger={toggle} />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <NavBar />
      </AppShell.Navbar>

      <AppShell.Main>
        <TrialBanner />
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
