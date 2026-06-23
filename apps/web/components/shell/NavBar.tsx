'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavLink, Stack } from '@mantine/core';
import {
  IconBuilding,
  IconCalendarEvent,
  IconChartBar,
  IconCurrencyDollar,
  IconGauge,
  IconLayoutKanban,
  IconMail,
  IconSettings,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';

type NavItem = {
  label: string;
  href: string;
  icon: typeof IconGauge;
  children?: { label: string; href: string; icon: typeof IconGauge }[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconGauge },
  { label: 'Pipelines', href: '/pipelines', icon: IconLayoutKanban },
  { label: 'Deals', href: '/deals', icon: IconCurrencyDollar },
  {
    label: 'Contacts',
    href: '/contacts',
    icon: IconUsers,
    children: [
      { label: 'People', href: '/contacts/people', icon: IconUser },
      { label: 'Companies', href: '/contacts/companies', icon: IconBuilding },
    ],
  },
  { label: 'Activities', href: '/activities', icon: IconCalendarEvent },
  { label: 'Email', href: '/emails', icon: IconMail },
  { label: 'Reports', href: '/reports', icon: IconChartBar },
  { label: 'Settings', href: '/settings/general', icon: IconSettings },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <Stack gap={4}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;

        if (item.children) {
          const sectionActive = pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              label={item.label}
              leftSection={<Icon size={18} stroke={1.5} />}
              defaultOpened={sectionActive}
              childrenOffset={28}
            >
              {item.children.map((child) => {
                const ChildIcon = child.icon;
                return (
                  <NavLink
                    key={child.href}
                    component={Link}
                    href={child.href}
                    label={child.label}
                    leftSection={<ChildIcon size={16} stroke={1.5} />}
                    active={pathname.startsWith(child.href)}
                  />
                );
              })}
            </NavLink>
          );
        }

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
