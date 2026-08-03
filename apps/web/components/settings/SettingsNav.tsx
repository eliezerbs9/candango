'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Group } from '@mantine/core';

const SECTIONS = [
  { label: 'Profile', href: '/settings/profile' },
  { label: 'General', href: '/settings/general' },
  { label: 'Members', href: '/settings/members' },
  { label: 'Roles', href: '/settings/roles' },
  { label: 'Fields', href: '/settings/custom-fields' },
  { label: 'Invoicing', href: '/settings/invoicing' },
  { label: 'Email Templates', href: '/settings/email-templates' },
  { label: 'Automations', href: '/settings/automations' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'API Keys', href: '/settings/api-keys' },
  { label: 'Webhooks', href: '/settings/webhooks' },
  { label: 'Integrations', href: '/settings/integrations' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <Group
      gap={2}
      wrap="nowrap"
      mb="lg"
      style={{ overflowX: 'auto', borderBottom: '1px solid var(--mantine-color-gray-3)' }}
    >
      {SECTIONS.map((s) => {
        const active = pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            style={{
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              padding: '10px 14px',
              marginBottom: -1, // active underline sits on the container's divider
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--mantine-color-candango-7)' : 'var(--mantine-color-dimmed)',
              borderBottom: active
                ? '2px solid var(--mantine-color-candango-6)'
                : '2px solid transparent',
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </Group>
  );
}
