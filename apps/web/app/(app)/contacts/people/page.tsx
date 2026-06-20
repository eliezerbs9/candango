'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { companyName, persons } from '@/lib/mock/data';
import type { Person } from '@/lib/types';

const columns: Column<Person>[] = [
  { key: 'name', header: 'Name', render: (p) => <Text fw={500}>{p.name}</Text> },
  { key: 'email', header: 'Email', render: (p) => p.email ?? '—' },
  { key: 'company', header: 'Company', render: (p) => companyName(p.companyId) },
];

export default function PeoplePage() {
  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${persons.length} contacts`}
        actions={<Button leftSection={<IconPlus size={16} />}>New person</Button>}
      />
      <DataTable
        columns={columns}
        data={persons}
        renderCard={(p) => (
          <Stack gap={2}>
            <Text fw={500}>{p.name}</Text>
            <Text size="sm" c="dimmed">
              {p.email} · {companyName(p.companyId)}
            </Text>
          </Stack>
        )}
      />
    </>
  );
}
