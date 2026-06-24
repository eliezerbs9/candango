'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { PageHeader } from '@/components/primitives/PageHeader';
import { DataTable, type Column } from '@/components/data/DataTable';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { ApiError } from '@/lib/api/client';
import {
  useCompanies,
  useCreateCompany,
  useCreatePerson,
  useDeletePerson,
  usePersons,
  useUpdatePerson,
} from '@/lib/api/hooks';
import type { ApiPerson } from '@/lib/api/contacts';

export default function PeoplePage() {
  const { data: persons = [], isLoading } = usePersons();
  const { data: companies = [] } = useCompanies();
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const del = useDeletePerson();
  const createCompany = useCreateCompany();

  const [opened, ctl] = useDisclosure(false);
  const [editing, setEditing] = useState<ApiPerson | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCompanyIds([]);
    setCustomFields({});
    ctl.open();
  };

  const openEdit = (p: ApiPerson) => {
    setEditing(p);
    setName(p.name);
    setEmail(p.email ?? '');
    setPhone(p.phone ?? '');
    setAddress(p.address ?? '');
    setCompanyIds(p.companies.map((c) => c.id));
    setCustomFields(p.customFields ?? {});
    ctl.open();
  };

  const remove = (p: ApiPerson) => {
    if (!window.confirm(`Delete “${p.name}”? This can't be undone.`)) return;
    del.mutate(p.id, {
      onSuccess: () => notifications.show({ message: 'Person deleted', color: 'green' }),
      onError: (e) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
    });
  };

  const rowMenu = (p: ApiPerson) => (
    <Menu withinPortal position="bottom-end" shadow="sm">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Actions">
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(p)}>
          Edit
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(p)}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const companyNames = (p: ApiPerson) => (p.companies.length ? p.companies.map((c) => c.name).join(', ') : '—');

  const columns: Column<ApiPerson>[] = [
    { key: 'name', header: 'Name', render: (p) => <Text fw={500}>{p.name}</Text> },
    { key: 'email', header: 'Email', render: (p) => p.email ?? '—' },
    { key: 'companies', header: 'Companies', render: companyNames },
    { key: 'actions', header: '', render: (p) => rowMenu(p) },
  ];

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    const body = {
      name: name.trim(),
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
      companyIds,
      customFields,
    };
    const onSuccess = () => {
      notifications.show({ message: editing ? 'Person updated' : 'Person created', color: 'green' });
      ctl.close();
    };
    const onError = (e: unknown) =>
      notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' });

    if (editing) update.mutate({ id: editing.id, ...body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
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
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New person
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={persons}
        renderCard={(p) => (
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={500}>{p.name}</Text>
              <Text size="sm" c="dimmed">
                {p.email ?? '—'} · {companyNames(p)}
              </Text>
            </Stack>
            {rowMenu(p)}
          </Group>
        )}
      />

      <Modal opened={opened} onClose={ctl.close} title={editing ? 'Edit person' : 'New person'}>
        <Stack>
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
          <TextInput label="Address" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
          <CreatableMultiSelect
            label="Companies"
            placeholder="Search or create companies"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={companyIds}
            onChange={setCompanyIds}
            onCreate={async (n) => {
              const c = await createCompany.mutateAsync({ name: n });
              return { value: c.id, label: c.name };
            }}
          />
          <CustomFieldsEditor
            entity="person"
            values={customFields}
            onChange={(k, v) => setCustomFields((prev) => ({ ...prev, [k]: v }))}
          />
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save changes' : 'Create person'}
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
