'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBolt, IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useAllStages,
  useAutomationTriggers,
  useCreateEmailAutomation,
  useDeleteEmailAutomation,
  useEmailAutomations,
  useEmailTemplates,
  useUpdateEmailAutomation,
} from '@/lib/api/hooks';
import type { AutomationTrigger, EmailAutomation } from '@/lib/api/email-automations';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function AutomationsSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: automations = [], isLoading } = useEmailAutomations();
  const { data: triggers = [] } = useAutomationTriggers();
  const { data: templates = [] } = useEmailTemplates();
  const del = useDeleteEmailAutomation();
  const update = useUpdateEmailAutomation();

  const triggerLabel = useMemo(() => Object.fromEntries(triggers.map((t) => [t.key, t.label])), [triggers]);

  const [editing, setEditing] = useState<EmailAutomation | null>(null);
  const [opened, ctl] = useDisclosure(false);

  const toggle = (a: EmailAutomation, enabled: boolean) =>
    update.mutate(
      { id: a.id, body: { enabled } },
      { onSuccess: () => notifications.show({ message: enabled ? 'Automation on' : 'Automation off', color: 'green' }), onError: fail },
    );
  const remove = (a: EmailAutomation) => {
    if (!window.confirm(`Delete automation "${a.name}"?`)) return;
    del.mutate(a.id, { onSuccess: () => notifications.show({ message: 'Automation deleted', color: 'green' }), onError: fail });
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
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={600}>Automations</Text>
          <Text size="sm" c="dimmed">
            Automatically send an email template when something happens on a deal. The email goes from the deal
            owner&apos;s mailbox to the deal&apos;s primary contact, with your signature.
          </Text>
        </div>
        {isAdmin && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              ctl.open();
            }}
            disabled={templates.length === 0}
          >
            New automation
          </Button>
        )}
      </Group>

      {templates.length === 0 && (
        <Text size="sm" c="dimmed">
          Create an email template first — automations send a template.
        </Text>
      )}

      {automations.length === 0 ? (
        <Text size="sm" c="dimmed">
          No automations yet.
        </Text>
      ) : (
        <Stack gap="sm">
          {automations.map((a) => (
            <Card key={a.id} withBorder radius="md" padding="md">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Switch checked={a.enabled} onChange={(e) => toggle(a, e.currentTarget.checked)} disabled={!isAdmin} />
                  <div style={{ minWidth: 0 }}>
                    <Text fw={500}>{a.name}</Text>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      When <b>{triggerLabel[a.trigger] ?? a.trigger}</b> → send <b>{a.templateName ?? 'template'}</b>
                    </Text>
                  </div>
                </Group>
                {isAdmin && (
                  <Menu position="bottom-end" withinPortal shadow="sm">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={14} />}
                        onClick={() => {
                          setEditing(a);
                          ctl.open();
                        }}
                      >
                        Edit
                      </Menu.Item>
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(a)}>
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <AutomationModal opened={opened} onClose={ctl.close} editing={editing} triggers={triggers} />
    </Stack>
  );
}

function AutomationModal({
  opened,
  onClose,
  editing,
  triggers,
}: {
  opened: boolean;
  onClose: () => void;
  editing: EmailAutomation | null;
  triggers: AutomationTrigger[];
}) {
  const create = useCreateEmailAutomation();
  const update = useUpdateEmailAutomation();
  const { data: templates = [] } = useEmailTemplates();
  const { data: stages = [] } = useAllStages();

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setTrigger(editing?.trigger ?? null);
    setTemplateId(editing?.templateId ?? null);
    setConfig(editing?.config ?? {});
    setEnabled(editing?.enabled ?? true);
  }, [opened, editing]);

  const def = triggers.find((t) => t.key === trigger);

  const submit = () => {
    if (!name.trim() || !trigger || !templateId) {
      notifications.show({ message: 'Name, trigger and template are required', color: 'red' });
      return;
    }
    const body = { name: name.trim(), trigger, templateId, config, enabled };
    const done = {
      onSuccess: () => {
        notifications.show({ message: editing ? 'Automation saved' : 'Automation created', color: 'green' });
        onClose();
      },
      onError: fail,
    };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit automation' : 'New automation'} centered>
      <Stack gap="sm">
        <TextInput
          label="Name"
          placeholder="e.g. Thank-you after invoice sent"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <Select
          label="When this happens (trigger)"
          required
          data={triggers.map((t) => ({
            value: t.key,
            label: t.kind === 'time' ? `${t.label} (coming soon)` : t.label,
            disabled: t.kind === 'time',
          }))}
          value={trigger}
          onChange={(v) => {
            setTrigger(v);
            setConfig({}); // reset config when the trigger changes
          }}
        />
        {def && <Text size="xs" c="dimmed">{def.description}</Text>}

        {/* Trigger-specific config */}
        {def?.fields.map((f) => {
          if (f.type === 'stage') {
            return (
              <Select
                key={f.key}
                label={f.label}
                placeholder="Any stage"
                clearable
                data={stages.map((s) => ({ value: s.id, label: s.name }))}
                value={(config[f.key] as string) ?? null}
                onChange={(v) => setConfig((c) => ({ ...c, [f.key]: v ?? undefined }))}
              />
            );
          }
          if (f.type === 'docKind') {
            return (
              <Select
                key={f.key}
                label={f.label}
                placeholder="Estimate or invoice"
                clearable
                data={[
                  { value: 'estimate', label: 'Estimate' },
                  { value: 'invoice', label: 'Invoice' },
                ]}
                value={(config[f.key] as string) ?? null}
                onChange={(v) => setConfig((c) => ({ ...c, [f.key]: v ?? undefined }))}
              />
            );
          }
          return (
            <NumberInput
              key={f.key}
              label={f.label}
              required={f.required}
              min={0}
              value={(config[f.key] as number) ?? ''}
              onChange={(v) => setConfig((c) => ({ ...c, [f.key]: v === '' ? undefined : Number(v) }))}
            />
          );
        })}

        <Select
          label="Send this template"
          required
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={templateId}
          onChange={setTemplateId}
        />
        <Switch label="Enabled" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<IconBolt size={16} />} onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
