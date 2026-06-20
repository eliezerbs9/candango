'use client';

import { Button, Group, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { companies } from '@/lib/mock/data';
import type { Company } from '@/lib/types';

const columns: Column<Company>[] = [
  { key: 'name', header: 'Name', render: (c) => <Text fw={500}>{c.name}</Text> },
  { key: 'domain', header: 'Domain', render: (c) => c.domain ?? '—' },
];

export default function CompaniesPage() {
  return (
    <>
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} companies`}
        actions={<Button leftSection={<IconPlus size={16} />}>New company</Button>}
      />
      <DataTable
        columns={columns}
        data={companies}
        renderCard={(c) => (
          <Group justify="space-between">
            <Text fw={500}>{c.name}</Text>
            <Text size="sm" c="dimmed">
              {c.domain}
            </Text>
          </Group>
        )}
      />
    </>
  );
}
