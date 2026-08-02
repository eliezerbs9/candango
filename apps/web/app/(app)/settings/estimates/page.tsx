'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Button,
  Card,
  Center,
  Checkbox,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { Money } from '@/components/primitives/Money';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useCreateEstimateItem,
  useDeleteEstimateItem,
  useEstimateItems,
  useOrganization,
  useQuickbooksStatus,
  useUpdateEstimateItem,
  useUpdateOrganization,
} from '@/lib/api/hooks';
import { POPULAR_UNITS } from '@/lib/units';
import type { EstimateItem } from '@/lib/api/estimate-items';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function EstimatesSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: org } = useOrganization();
  const { data: qb } = useQuickbooksStatus();
  const connected = !!qb?.connected;
  const updateOrg = useUpdateOrganization();
  const { data: items = [], isLoading } = useEstimateItems();

  const [taxPct, setTaxPct] = useState<number | string>(0);
  const [taxDefault, setTaxDefault] = useState(false);
  useEffect(() => {
    if (org) {
      setTaxPct((org.taxRateBps ?? 0) / 100);
      setTaxDefault(org.taxDefaultOn ?? false);
    }
  }, [org]);

  const saveTax = () =>
    updateOrg.mutate(
      { taxRateBps: Math.round(Number(taxPct || 0) * 100), taxDefaultOn: taxDefault },
      { onSuccess: () => notifications.show({ message: 'Tax settings saved', color: 'green' }), onError: fail },
    );

  const [editing, setEditing] = useState<EstimateItem | null>(null);
  const [opened, ctl] = useDisclosure(false);
  const del = useDeleteEstimateItem();

  const openCreate = () => {
    setEditing(null);
    ctl.open();
  };
  const openEdit = (it: EstimateItem) => {
    setEditing(it);
    ctl.open();
  };
  const remove = (it: EstimateItem) => {
    if (!window.confirm(`Delete "${it.name}"?`)) return;
    del.mutate(it.id, {
      onSuccess: () => notifications.show({ message: 'Item deleted', color: 'green' }),
      onError: fail,
    });
  };

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Text fw={600}>Invoicing</Text>
        <Text size="sm" c="dimmed">
          Reusable line items for your estimates and invoices, plus your sales-tax settings. When QuickBooks is
          connected, estimates use QuickBooks products and its automated sales tax instead.
        </Text>
      </div>

      {/* Tax settings */}
      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Checkbox
            label="Apply sales tax by default on new estimates and invoices"
            description={
              connected
                ? 'The tax rate comes from your QuickBooks automated sales tax.'
                : 'Turn this on and set your local rate below.'
            }
            checked={taxDefault}
            onChange={(e) => setTaxDefault(e.currentTarget.checked)}
            disabled={!isAdmin}
          />
          {/* Local rate only matters when NOT connected to QuickBooks. */}
          {!connected && taxDefault && (
            <NumberInput
              label="Sales tax rate"
              description="Applied to local estimates/invoices. Set your jurisdiction's rate."
              suffix="%"
              min={0}
              max={50}
              decimalScale={2}
              step={0.25}
              value={taxPct}
              onChange={setTaxPct}
              disabled={!isAdmin}
              w={220}
            />
          )}
          {isAdmin && (
            <Button onClick={saveTax} loading={updateOrg.isPending} w="fit-content">
              Save
            </Button>
          )}
        </Stack>
      </Card>

      <Divider />

      {/* Items catalog */}
      <Group justify="space-between">
        <Text fw={600}>Item catalog</Text>
        {isAdmin && (
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add item
          </Button>
        )}
      </Group>

      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No items yet. Add products/services you use often to add them to estimates in one click.
        </Text>
      ) : (
        <Card withBorder radius="md" padding={0}>
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th ta="right">Price</Table.Th>
                <Table.Th w={44} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    <Text fw={500}>{it.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {it.description || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {it.unit || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    {it.unitPrice != null ? <Money value={it.unitPrice} currency="USD" /> : <Text c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    {isAdmin && (
                      <Menu position="bottom-end" withinPortal shadow="sm">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openEdit(it)}>
                            Edit
                          </Menu.Item>
                          <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(it)}>
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <ItemModal opened={opened} onClose={ctl.close} editing={editing} />
    </Stack>
  );
}

function ItemModal({ opened, onClose, editing }: { opened: boolean; onClose: () => void; editing: EstimateItem | null }) {
  const create = useCreateEstimateItem();
  const update = useUpdateEstimateItem();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<number | string>('');

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setUnit(editing?.unit ?? '');
    setPrice(editing?.unitPrice != null ? editing.unitPrice / 100 : '');
  }, [opened, editing]);

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      unit: unit.trim() || undefined,
      unitPrice: price === '' ? undefined : Math.round(Number(price) * 100),
    };
    const done = {
      onSuccess: () => {
        notifications.show({ message: editing ? 'Item saved' : 'Item added', color: 'green' });
        onClose();
      },
      onError: fail,
    };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit item' : 'New item'} centered>
      <Stack gap="sm">
        <TextInput label="Name" required value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <Textarea
          label="Description"
          description="Optional"
          autosize
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Autocomplete
          label="Unit"
          description="Unit of measure — pick a common one or type your own"
          placeholder="unit"
          data={POPULAR_UNITS}
          value={unit}
          onChange={setUnit}
        />
        <NumberInput
          label="Price"
          description="Optional — leave blank to set it per estimate"
          prefix="$"
          thousandSeparator=","
          min={0}
          decimalScale={2}
          value={price}
          onChange={setPrice}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save' : 'Add'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
