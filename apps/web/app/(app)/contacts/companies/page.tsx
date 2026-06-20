'use client';

import { useState } from 'react';
import { Button, Center, Group, Loader, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ApiError } from '@/lib/api/client';
import { useCompanies, useCreateCompany } from '@/lib/api/hooks';
import type { ApiCompany } from '@/lib/api/contacts';

export default function CompaniesPage() {
  const { data: companies = [], isLoading } = useCompanies();
  const [opened, ctl] = useDisclosure(false);
  const create = useCreateCompany();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  const columns: Column<ApiCompany>[] = [
    { key: 'name', header: 'Name', render: (c) => <Text fw={500}>{c.name}</Text> },
    { key: 'domain', header: 'Domain', render: (c) => c.domain ?? '—' },
  ];

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    create.mutate(
      { name: name.trim(), domain: domain || undefined },
      {
        onSuccess: () => {
          notifications.show({ message: 'Company created', color: 'green' });
          setName('');
          setDomain('');
          ctl.close();
        },
        onError: (e) => notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
      },
    );
  };

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle={`${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={ctl.open}>
            New company
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={companies}
        renderCard={(c) => (
          <Group justify="space-between">
            <Text fw={500}>{c.name}</Text>
            <Text size="sm" c="dimmed">
              {c.domain ?? '—'}
            </Text>
          </Group>
        )}
      />

      <Modal opened={opened} onClose={ctl.close} title="New company">
        <Stack>
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput
            label="Domain"
            placeholder="acme.com"
            value={domain}
            onChange={(e) => setDomain(e.currentTarget.value)}
          />
          <Button onClick={submit} loading={create.isPending}>
            Create company
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
