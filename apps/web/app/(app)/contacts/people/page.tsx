'use client';

import { useState } from 'react';
import { Button, Center, Loader, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ApiError } from '@/lib/api/client';
import { useCompanies, useCreatePerson, usePersons } from '@/lib/api/hooks';
import type { ApiPerson } from '@/lib/api/contacts';

export default function PeoplePage() {
  const { data: persons = [], isLoading } = usePersons();
  const { data: companies = [] } = useCompanies();
  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? '—';

  const [opened, ctl] = useDisclosure(false);
  const create = useCreatePerson();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);

  const columns: Column<ApiPerson>[] = [
    { key: 'name', header: 'Name', render: (p) => <Text fw={500}>{p.name}</Text> },
    { key: 'email', header: 'Email', render: (p) => p.email ?? '—' },
    { key: 'company', header: 'Company', render: (p) => companyName(p.companyId) },
  ];

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    create.mutate(
      { name: name.trim(), email: email || undefined, phone: phone || undefined, companyId: companyId || undefined },
      {
        onSuccess: () => {
          notifications.show({ message: 'Person created', color: 'green' });
          setName('');
          setEmail('');
          setPhone('');
          setCompanyId(null);
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
        title="People"
        subtitle={`${persons.length} contact${persons.length === 1 ? '' : 's'}`}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={ctl.open}>
            New person
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={persons}
        renderCard={(p) => (
          <Stack gap={2}>
            <Text fw={500}>{p.name}</Text>
            <Text size="sm" c="dimmed">
              {p.email ?? '—'} · {companyName(p.companyId)}
            </Text>
          </Stack>
        )}
      />

      <Modal opened={opened} onClose={ctl.close} title="New person">
        <Stack>
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
          <Select
            label="Company"
            data={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={companyId}
            onChange={setCompanyId}
            searchable
            clearable
          />
          <Button onClick={submit} loading={create.isPending}>
            Create person
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
