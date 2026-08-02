'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
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
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBolt, IconBrandGoogle, IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useAllStages,
  useAutomationTriggers,
  useCreateEmailAutomation,
  useDeleteEmailAutomation,
  useEmailAutomations,
  useEmailTemplates,
  useGoogleStatus,
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
  const { data: google } = useGoogleStatus();
  const del = useDeleteEmailAutomation();
  const update = useUpdateEmailAutomation();

  const triggerLabel = useMemo(() => Object.fromEntries(triggers.map((t) => [t.key, t.label])), [triggers]);
  const { data: stages = [] } = useAllStages();
  const stageName = (id: unknown) => (typeof id === 'string' ? stages.find((s) => s.id === id)?.name : null);

  // Human-readable "when …" clause describing the trigger + its config.
  const triggerText = (a: EmailAutomation) => {
    const c = a.config;
    switch (a.trigger) {
      case 'deal_stage_changed':
        return c.stageId ? <>a deal enters <b>{stageName(c.stageId) ?? 'a stage'}</b></> : <>a deal enters <b>any stage</b></>;
      case 'deal_won':
        return <>a deal is <b>won</b></>;
      case 'deal_lost':
        return <>a deal is <b>lost</b></>;
      case 'doc_sent':
        return c.docKind ? <>an <b>{String(c.docKind)}</b> is sent</> : <>an <b>estimate/invoice</b> is sent</>;
      case 'follow_up': {
        const d = Number(c.afterDays) || 0;
        return (
          <>
            a deal stays in <b>{stageName(c.stageId) ?? 'any stage'}</b> for <b>{d} day{d === 1 ? '' : 's'}</b>
          </>
        );
      }
      default:
        return <b>{triggerLabel[a.trigger] ?? a.trigger}</b>;
    }
  };

  // Human-readable "then …" clause describing the action + its config.
  const actionText = (a: EmailAutomation) => {
    const c = a.config;
    if (a.action === 'create_activity') {
      const type = (c.activityType as string) || 'task';
      const kind = type === 'call' ? 'Call' : type === 'meeting' ? 'Meeting' : null; // a plain task = a generic activity
      const days = Number(c.dueInDays) || 0;
      const due = days === 0 ? 'due the same day' : `due in ${days} day${days === 1 ? '' : 's'}`;
      const subject = String(c.activitySubject ?? '').trim();
      return (
        <>
          create an activity{subject ? <> “<b>{subject}</b>”</> : ''} ({kind ? `${kind}, ` : ''}
          {due})
        </>
      );
    }
    return (
      <>
        send the <b>{a.templateName ?? 'template'}</b> email to the primary contact
      </>
    );
  };

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
            When something happens on a deal, automatically <b>send an email</b> (from the deal owner&apos;s mailbox to
            the primary contact, with your signature) or <b>create an activity</b> for the deal owner.
          </Text>
        </div>
        {isAdmin && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              ctl.open();
            }}
          >
            New automation
          </Button>
        )}
      </Group>

      {!google?.mailbox && (
        <Alert variant="light" color="yellow" icon={<IconBrandGoogle size={16} />} title="Email actions need Google">
          Your workspace has no Google connection, so <b>“send an email” automations won&apos;t fire</b> — only
          “create an activity” ones will. Connect Google under Settings → Integrations to enable email automations.
        </Alert>
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
                  <Tooltip
                    label="Connect Google to enable email automations"
                    disabled={!(a.action === 'send_email' && !google?.mailbox)}
                    withArrow
                    multiline
                    w={220}
                  >
                    <div>
                      <Switch
                        checked={a.enabled}
                        onChange={(e) => toggle(a, e.currentTarget.checked)}
                        disabled={!isAdmin || (a.action === 'send_email' && !google?.mailbox)}
                      />
                    </div>
                  </Tooltip>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={500}>{a.name}</Text>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      <b>When</b> {triggerText(a)}, <b>then</b> {actionText(a)}.
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
  const { data: google } = useGoogleStatus();

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<string | null>(null);
  const [action, setAction] = useState<'send_email' | 'create_activity'>('send_email');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setTrigger(editing?.trigger ?? null);
    setAction(editing?.action ?? 'send_email');
    setTemplateId(editing?.templateId ?? null);
    setConfig(editing?.config ?? {});
    setEnabled(editing?.enabled ?? true);
  }, [opened, editing]);

  const def = triggers.find((t) => t.key === trigger);
  const setCfg = (key: string, value: unknown) => setConfig((c) => ({ ...c, [key]: value }));

  const submit = () => {
    if (!name.trim() || !trigger) {
      notifications.show({ message: 'Name and trigger are required', color: 'red' });
      return;
    }
    if (action === 'send_email' && !templateId) {
      notifications.show({ message: 'Pick a template to send', color: 'red' });
      return;
    }
    if (action === 'create_activity' && !String(config.activitySubject ?? '').trim()) {
      notifications.show({ message: 'Give the task a subject', color: 'red' });
      return;
    }
    const body = {
      name: name.trim(),
      trigger,
      action,
      templateId: action === 'send_email' ? templateId ?? undefined : undefined,
      config,
      // Email automations can't start on without a mailbox — the server enforces this too.
      enabled: action === 'send_email' && !google?.mailbox ? false : enabled,
    };
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
            label: t.comingSoon ? `${t.label} (coming soon)` : t.label,
            disabled: t.comingSoon,
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
          label="Then do this (action)"
          required
          data={[
            { value: 'send_email', label: 'Send an email' },
            { value: 'create_activity', label: 'Create an activity' },
          ]}
          value={action}
          onChange={(v) => setAction((v as 'send_email' | 'create_activity') ?? 'send_email')}
        />

        {action === 'send_email' ? (
          <Select
            label="Send this template"
            required
            placeholder={templates.length === 0 ? 'Create a template first' : 'Pick a template'}
            data={templates.map((t) => ({ value: t.id, label: t.name }))}
            value={templateId}
            onChange={setTemplateId}
          />
        ) : (
          <>
            <Select
              label="Activity type"
              description="Same activity types as the deal's New activity form"
              data={[
                { value: 'task', label: 'Task' },
                { value: 'call', label: 'Call' },
                { value: 'meeting', label: 'Meeting' },
              ]}
              value={(config.activityType as string) ?? 'task'}
              onChange={(v) => setCfg('activityType', v ?? 'task')}
            />
            <TextInput
              label="Activity subject"
              required
              placeholder="e.g. Follow up with the client"
              value={(config.activitySubject as string) ?? ''}
              onChange={(e) => setCfg('activitySubject', e.currentTarget.value)}
            />
            <NumberInput
              label="Due in (days)"
              description="0 = same day"
              min={0}
              value={(config.dueInDays as number) ?? 0}
              onChange={(v) => setCfg('dueInDays', v === '' ? 0 : Number(v))}
            />
          </>
        )}
        <Switch
          label="Enabled"
          description={
            action === 'send_email' && !google?.mailbox
              ? 'Connect Google to enable email automations — it will be created but stay off until then.'
              : undefined
          }
          checked={enabled && !(action === 'send_email' && !google?.mailbox)}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
          disabled={action === 'send_email' && !google?.mailbox}
        />

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
