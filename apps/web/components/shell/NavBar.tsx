'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavLink, Stack } from '@mantine/core';
import {
  IconCalendarEvent,
  IconChartBar,
  IconCurrencyDollar,
  IconGauge,
  IconLayoutKanban,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: IconGauge },
  { label: 'Pipelines', href: '/pipelines', icon: IconLayoutKanban },
  { label: 'Deals', href: '/deals', icon: IconCurrencyDollar },
  { label: 'Contacts', href: '/contacts/people', icon: IconUsers },
  { label: 'Activities', href: '/activities', icon: IconCalendarEvent },
  { label: 'Reports', href: '/reports', icon: IconChartBar },
  { label: 'Settings', href: '/settings/general', icon: IconSettings },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <Stack gap={4}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.href}
            component={Link}
            href={item.href}
            label={item.label}
            leftSection={<Icon size={18} stroke={1.5} />}
            active={pathname.startsWith(item.href)}
          />
        );
      })}
    </Stack>
  );
}
