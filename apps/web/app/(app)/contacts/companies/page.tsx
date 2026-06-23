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
  Textarea,
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
  useDeleteCompany,
  usePersons,
  useUpdateCompany,
} from '@/lib/api/hooks';
import type { ApiCompany } from '@/lib/api/contacts';

export default function CompaniesPage() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: persons = [] } = usePersons();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const del = useDeleteCompany();
  const createPerson = useCreatePerson();

  const [opened, ctl] = useDisclosure(false);
  const [editing, setEditing] = useState<ApiCompany | null>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDomain('');
    setAddress('');
    setPhone('');
    setContactIds([]);
    setCustomFields({});
    ctl.open();
  };

  const openEdit = (c: ApiCompany) => {
    setEditing(c);
    setName(c.name);
    setDomain(c.domain ?? '');
    setAddress(c.address ?? '');
    setPhone(c.phone ?? '');
    setContactIds(c.contacts.map((p) => p.id));
    setCustomFields(c.customFields ?? {});
    ctl.open();
  };

  const remove = (c: ApiCompany) => {
    if (!window.confirm(`Delete “${c.name}”? This can't be undone.`)) return;
    del.mutate(c.id, {
      onSuccess: () => notifications.show({ message: 'Company deleted', color: 'green' }),
      onError: (e) =>
        notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
    });
  };

  const rowMenu = (c: ApiCompany) => (
    <Menu withinPortal position="bottom-end" shadow="sm">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Actions">
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(c)}>
          Edit
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(c)}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  const contactNames = (c: ApiCompany) =>
    c.contacts.length ? c.contacts.map((p) => p.name).join(', ') : '—';

  const columns: Column<ApiCompany>[] = [
    { key: 'name', header: 'Name', render: (c) => <Text fw={500}>{c.name}</Text> },
    { key: 'domain', header: 'Domain', render: (c) => c.domain ?? '—' },
    { key: 'contacts', header: 'Contacts', render: contactNames },
    { key: 'actions', header: '', render: (c) => rowMenu(c) },
  ];

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    const body = {
      name: name.trim(),
      domain: domain || undefined,
      address: address || undefined,
      phone: phone || undefined,
      contactIds,
      customFields,
    };
    const onSuccess = () => {
      notifications.show({ message: editing ? 'Company updated' : 'Company created', color: 'green' });
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
        title="Companies"
        subtitle={`${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New company
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={companies}
        renderCard={(c) => (
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={500}>{c.name}</Text>
              <Text size="sm" c="dimmed">
                {c.domain ?? '—'} · {contactNames(c)}
              </Text>
            </Stack>
            {rowMenu(c)}
          </Group>
        )}
      />

      <Modal opened={opened} onClose={ctl.close} title={editing ? 'Edit company' : 'New company'}>
        <Stack>
          <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput
            label="Domain"
            placeholder="acme.com"
            value={domain}
            onChange={(e) => setDomain(e.currentTarget.value)}
          />
          <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
          <Textarea
            label="Address"
            placeholder="Street, city, state, ZIP"
            autosize
            minRows={2}
            value={address}
            onChange={(e) => setAddress(e.currentTarget.value)}
          />
          <CreatableMultiSelect
            label="Contact people"
            placeholder="Search or create people"
            options={persons.map((p) => ({ value: p.id, label: p.name }))}
            value={contactIds}
            onChange={setContactIds}
            onCreate={async (n) => {
              const p = await createPerson.mutateAsync({ name: n });
              return { value: p.id, label: p.name };
            }}
          />
          <CustomFieldsEditor
            entity="company"
            values={customFields}
            onChange={(k, v) => setCustomFields((prev) => ({ ...prev, [k]: v }))}
          />
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save changes' : 'Create company'}
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
