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
  useCreateQbItem,
  useDeleteEstimateItem,
  useDeleteQbItem,
  useEstimateItems,
  useOrganization,
  useQbCatalog,
  useQuickbooksStatus,
  useUpdateEstimateItem,
  useUpdateQbItem,
  useUpdateOrganization,
} from '@/lib/api/hooks';
import { POPULAR_UNITS } from '@/lib/units';
import type { EstimateItem } from '@/lib/api/estimate-items';

type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  unitPrice?: number | null;
  taxable?: boolean;
};

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
  const qbCatalog = useQbCatalog(connected);
  // When QuickBooks is connected the catalog is its products/services; otherwise the local catalog.
  const catalog: CatalogItem[] = connected ? qbCatalog.data ?? [] : items;

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

  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [opened, ctl] = useDisclosure(false);
  const del = useDeleteEstimateItem();
  const deleteQb = useDeleteQbItem();
  const updateQb = useUpdateQbItem();

  const openCreate = () => {
    setEditing(null);
    ctl.open();
  };
  const openEdit = (it: CatalogItem) => {
    setEditing(it);
    ctl.open();
  };
  const remove = (it: CatalogItem) => {
    const msg = connected
      ? `Deactivate "${it.name}" in QuickBooks? It won't be deleted, just made inactive.`
      : `Delete "${it.name}"?`;
    if (!window.confirm(msg)) return;
    const done = {
      onSuccess: () => notifications.show({ message: connected ? 'Item deactivated' : 'Item deleted', color: 'green' }),
      onError: fail,
    };
    if (connected) deleteQb.mutate(it.id, done);
    else del.mutate(it.id, done);
  };
  // Auto-save the taxable flag on a QuickBooks item when the checkbox is toggled.
  const toggleTaxable = (it: CatalogItem, taxable: boolean) => {
    updateQb.mutate(
      { id: it.id, body: { taxable } },
      {
        onSuccess: () => notifications.show({ message: `Marked ${taxable ? 'taxable' : 'non-taxable'}`, color: 'green' }),
        onError: fail,
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
      <div>
        <Group justify="space-between">
          <Text fw={600}>Item catalog{connected ? ' (QuickBooks)' : ''}</Text>
          {isAdmin && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Add item
            </Button>
          )}
        </Group>
        {connected && (
          <Text size="xs" c="dimmed">
            These are your QuickBooks products/services. Changes here sync straight to QuickBooks. Toggle{' '}
            <b>Taxable</b> to control whether QuickBooks charges sales tax on a line.
          </Text>
        )}
      </div>

      {catalog.length === 0 ? (
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
                {connected ? <Table.Th ta="center">Taxable</Table.Th> : <Table.Th>Unit</Table.Th>}
                <Table.Th ta="right">Price</Table.Th>
                <Table.Th w={44} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {catalog.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td>
                    <Text fw={500}>{it.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {it.description || '—'}
                    </Text>
                  </Table.Td>
                  {connected ? (
                    <Table.Td ta="center">
                      <Checkbox
                        checked={!!it.taxable}
                        onChange={(e) => toggleTaxable(it, e.currentTarget.checked)}
                        disabled={!isAdmin || updateQb.isPending}
                        aria-label={`Taxable: ${it.name}`}
                        style={{ display: 'inline-block' }}
                      />
                    </Table.Td>
                  ) : (
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {it.unit || '—'}
                      </Text>
                    </Table.Td>
                  )}
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
                            {connected ? 'Deactivate' : 'Delete'}
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

      <ItemModal opened={opened} onClose={ctl.close} editing={editing} qbo={connected} />
    </Stack>
  );
}

function ItemModal({
  opened,
  onClose,
  editing,
  qbo,
}: {
  opened: boolean;
  onClose: () => void;
  editing: CatalogItem | null;
  qbo: boolean;
}) {
  const create = useCreateEstimateItem();
  const update = useUpdateEstimateItem();
  const createQb = useCreateQbItem();
  const updateQb = useUpdateQbItem();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [taxable, setTaxable] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setUnit(editing?.unit ?? '');
    setPrice(editing?.unitPrice != null ? editing.unitPrice / 100 : '');
    setTaxable(!!editing?.taxable);
  }, [opened, editing]);

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' });
      return;
    }
    const unitPrice = price === '' ? undefined : Math.round(Number(price) * 100);
    const done = {
      onSuccess: () => {
        notifications.show({ message: editing ? 'Item saved' : 'Item added', color: 'green' });
        onClose();
      },
      onError: fail,
    };
    if (qbo) {
      // QuickBooks items have no unit of measure; taxability is set per item.
      const qbBody = { name: name.trim(), description: description.trim() || undefined, unitPrice, taxable };
      if (editing) updateQb.mutate({ id: editing.id, body: qbBody }, done);
      else createQb.mutate(qbBody, done);
      return;
    }
    const body = { name: name.trim(), description: description.trim() || undefined, unit: unit.trim() || undefined, unitPrice };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={qbo ? (editing ? 'Edit QuickBooks item' : 'New QuickBooks item') : editing ? 'Edit item' : 'New item'}
      centered
    >
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
        {!qbo && (
          <Autocomplete
            label="Unit"
            description="Unit of measure — pick a common one or type your own"
            placeholder="unit"
            data={POPULAR_UNITS}
            value={unit}
            onChange={setUnit}
          />
        )}
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
        {qbo && (
          <Checkbox
            label="Taxable"
            description="QuickBooks charges sales tax on lines that use this item."
            checked={taxable}
            onChange={(e) => setTaxable(e.currentTarget.checked)}
          />
        )}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={create.isPending || update.isPending || createQb.isPending || updateQb.isPending}
          >
            {editing ? 'Save' : 'Add'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
