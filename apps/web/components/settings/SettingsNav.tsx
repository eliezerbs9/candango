'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Group } from '@mantine/core';

const SECTIONS = [
  { label: 'Members', href: '/settings/members' },
  { label: 'Roles', href: '/settings/roles' },
  { label: 'Billing', href: '/settings/billing' },
  { label: 'Branding', href: '/settings/branding' },
  { label: 'API Keys', href: '/settings/api-keys' },
  { label: 'Webhooks', href: '/settings/webhooks' },
  { label: 'Integrations', href: '/settings/integrations' },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <Group gap="xs" wrap="nowrap" mb="lg" style={{ overflowX: 'auto' }}>
      {SECTIONS.map((s) => {
        const active = pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            style={{
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--mantine-color-indigo-7)' : 'var(--mantine-color-dimmed)',
              background: active ? 'var(--mantine-color-indigo-0)' : 'transparent',
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </Group>
  );
}
