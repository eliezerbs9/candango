'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
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
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { ScheduleBuilder } from '@/components/automations/ScheduleBuilder';
import { AudienceBuilder } from '@/components/automations/AudienceBuilder';
import {
  useAllStages,
  useAutomationTriggers,
  useCreateEmailAutomation,
  useCreateMarketingAutomation,
  useDeleteEmailAutomation,
  useEmailAutomations,
  useEmailTemplates,
  useGoogleStatus,
  useOrganization,
  useSignableDocuments,
  useUpdateEmailAutomation,
  useUpdateMarketingAutomation,
} from '@/lib/api/hooks';
import type {
  AutomationKind,
  AutomationTrigger,
  EmailAutomation,
  MarketingAudience,
  MarketingSchedule,
} from '@/lib/api/email-automations';
import { describeSchedule } from '@/lib/marketing-format';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function AutomationsSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: automations = [], isLoading } = useEmailAutomations();
  const { data: triggers = [] } = useAutomationTriggers();
  const { data: templates = [] } = useEmailTemplates();
  const { data: signableDocs = [] } = useSignableDocuments();
  const { data: google } = useGoogleStatus();
  const del = useDeleteEmailAutomation();
  const update = useUpdateEmailAutomation();
  const updateMkt = useUpdateMarketingAutomation();

  const triggerLabel = useMemo(() => Object.fromEntries(triggers.map((t) => [t.key, t.label])), [triggers]);
  const allTags = useMemo(
    () => [...new Set(automations.flatMap((a) => a.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [automations],
  );

  // Type (deal/marketing) + tag filters for the list.
  const [filterKind, setFilterKind] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const visible = useMemo(
    () =>
      automations.filter(
        (a) =>
          (!filterKind || (a.kind ?? 'deal') === filterKind) && (!filterTag || (a.tags ?? []).includes(filterTag)),
      ),
    [automations, filterKind, filterTag],
  );
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
    if (a.action === 'request_signature') {
      const docName = signableDocs.find((d) => d.id === c.signableDocumentTemplateId)?.name;
      return (
        <>
          request a signature on <b>{docName ?? 'a document'}</b> from the primary contact
        </>
      );
    }
    return (
      <>
        send the <b>{a.templateName ?? 'template'}</b> email to the primary contact
      </>
    );
  };

  // Full "when/then" (deal) or "what/schedule/audience" (marketing) summary shown on each card.
  const summary = (a: EmailAutomation) => {
    if (a.kind === 'marketing') {
      const cfg = a.config as { schedule?: MarketingSchedule; audience?: MarketingAudience };
      const sched = cfg.schedule ? describeSchedule(cfg.schedule) : 'on a schedule';
      const aud =
        cfg.audience?.type === 'label'
          ? `contacts labelled ${(cfg.audience.tags ?? []).join(', ')}`
          : cfg.audience?.type === 'deal_stage'
            ? 'contacts with a deal in a stage'
            : cfg.audience?.type === 'filter'
              ? 'a filtered set of contacts'
              : 'all subscribed contacts';
      return (
        <>
          <b>Send</b> {a.templateName ?? 'a template'} to {aud}, <b>{sched}</b>.
        </>
      );
    }
    return (
      <>
        <b>When</b> {triggerText(a)}, <b>then</b> {actionText(a)}.
      </>
    );
  };

  const [editing, setEditing] = useState<EmailAutomation | null>(null);
  const [opened, ctl] = useDisclosure(false);

  const toggle = (a: EmailAutomation, enabled: boolean) => {
    const opts = {
      onSuccess: () => notifications.show({ message: enabled ? 'Automation on' : 'Automation off', color: 'green' }),
      onError: fail,
    };
    // Marketing rows must go through the marketing endpoint so nextRunAt is recomputed on enable.
    if (a.kind === 'marketing') updateMkt.mutate({ id: a.id, body: { enabled } }, opts);
    else update.mutate({ id: a.id, body: { enabled } }, opts);
  };
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
          “create an activity” ones will. Connect Google under{' '}
          <Anchor component={Link} href="/settings/integrations">
            Settings → Integrations
          </Anchor>{' '}
          to enable email automations.
        </Alert>
      )}

      {automations.length > 0 && (
        <Group gap="sm">
          <Select
            size="xs"
            placeholder="All types"
            clearable
            w={180}
            data={[
              { value: 'deal', label: 'Deal — triggered' },
              { value: 'marketing', label: 'Marketing — scheduled' },
            ]}
            value={filterKind}
            onChange={setFilterKind}
          />
          <Select
            size="xs"
            placeholder="All tags"
            clearable
            w={180}
            disabled={allTags.length === 0}
            data={allTags.map((t) => ({ value: t, label: t }))}
            value={filterTag}
            onChange={setFilterTag}
          />
          {(filterKind || filterTag) && (
            <Text size="xs" c="dimmed">
              {visible.length} of {automations.length}
            </Text>
          )}
        </Group>
      )}

      {automations.length === 0 ? (
        <Text size="sm" c="dimmed">
          No automations yet.
        </Text>
      ) : visible.length === 0 ? (
        <Text size="sm" c="dimmed">
          No automations match these filters.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {visible.map((a) => {
            const gmailBlocked = a.kind !== 'marketing' && a.action === 'send_email' && !google?.mailbox;
            return (
              <Card key={a.id} withBorder radius="md" padding="md">
                <Stack gap="xs" style={{ height: '100%' }}>
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap={6} wrap="wrap" align="center" style={{ minWidth: 0 }}>
                      <Text fw={600} lineClamp={1}>
                        {a.name}
                      </Text>
                      {a.kind === 'marketing' && (
                        <Badge size="xs" variant="light" color="grape" style={{ textTransform: 'none' }}>
                          Marketing
                        </Badge>
                      )}
                      {(a.tags ?? []).map((tag) => (
                        <Badge key={tag} size="xs" variant="light" color="candango" style={{ textTransform: 'none' }}>
                          {tag}
                        </Badge>
                      ))}
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

                  <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
                    {summary(a)}
                  </Text>

                  <Tooltip
                    label="Connect Google to enable deal email automations"
                    disabled={!gmailBlocked}
                    withArrow
                    multiline
                    w={220}
                  >
                    <div>
                      <Switch
                        size="sm"
                        checked={a.enabled}
                        label={a.enabled ? 'On' : 'Off'}
                        onChange={(e) => toggle(a, e.currentTarget.checked)}
                        disabled={!isAdmin || gmailBlocked}
                      />
                    </div>
                  </Tooltip>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      <AutomationModal opened={opened} onClose={ctl.close} editing={editing} triggers={triggers} allTags={allTags} />
    </Stack>
  );
}

const DEFAULT_SCHEDULE: MarketingSchedule = { type: 'daily', atTime: '09:00', everyDays: 1 };
const DEFAULT_AUDIENCE: MarketingAudience = { type: 'all' };
const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

function AutomationModal({
  opened,
  onClose,
  editing,
  triggers,
  allTags,
}: {
  opened: boolean;
  onClose: () => void;
  editing: EmailAutomation | null;
  triggers: AutomationTrigger[];
  allTags: string[];
}) {
  const create = useCreateEmailAutomation();
  const update = useUpdateEmailAutomation();
  const createMkt = useCreateMarketingAutomation();
  const updateMkt = useUpdateMarketingAutomation();
  const { data: templates = [] } = useEmailTemplates();
  // A missing/legacy scope defaults to 'deal' (matches the DB default) so pre-scope templates still show.
  const dealTemplates = useMemo(() => templates.filter((t) => t.scope !== 'marketing'), [templates]);
  const marketingTemplates = useMemo(() => templates.filter((t) => t.scope === 'marketing'), [templates]);
  const { data: stages = [] } = useAllStages();
  const { data: google } = useGoogleStatus();
  const { data: org } = useOrganization();

  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [action, setAction] = useState<'send_email' | 'create_activity' | 'request_signature'>('send_email');
  const { data: signableDocs = [] } = useSignableDocuments();
  // The Deal/Marketing "type" applies only to a Send-email action (an activity is always deal-side).
  const [kind, setKind] = useState<AutomationKind>('deal');
  const [trigger, setTrigger] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [enabled, setEnabled] = useState(true);
  // Marketing-only:
  const [schedule, setSchedule] = useState<MarketingSchedule>(DEFAULT_SCHEDULE);
  const [audience, setAudience] = useState<MarketingAudience>(DEFAULT_AUDIENCE);
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    if (!opened) return;
    setName(editing?.name ?? '');
    setTags(editing?.tags ?? []);
    setAction(editing?.action ?? 'send_email');
    setKind(editing?.kind ?? 'deal');
    setTrigger(editing?.trigger || null);
    setTemplateId(editing?.templateId ?? null);
    setConfig(editing?.config ?? {});
    setEnabled(editing?.enabled ?? true);
    const cfg = (editing?.config ?? {}) as { schedule?: MarketingSchedule; audience?: MarketingAudience };
    setSchedule(editing?.kind === 'marketing' && cfg.schedule ? cfg.schedule : DEFAULT_SCHEDULE);
    setAudience(editing?.kind === 'marketing' && cfg.audience ? cfg.audience : DEFAULT_AUDIENCE);
    setTimezone(editing?.timezone || org?.timezone || browserTz());
  }, [opened, editing, org?.timezone]);

  // Type drives the form: a marketing automation is always a scheduled email broadcast.
  const isMarketing = kind === 'marketing';
  const def = triggers.find((t) => t.key === trigger);
  const setCfg = (key: string, value: unknown) => setConfig((c) => ({ ...c, [key]: value }));
  const pending = create.isPending || update.isPending || createMkt.isPending || updateMkt.isPending;

  const done = {
    onSuccess: () => {
      notifications.show({ message: editing ? 'Automation saved' : 'Automation created', color: 'green' });
      onClose();
    },
    onError: fail,
  };

  const submit = () => {
    if (!name.trim()) {
      notifications.show({ message: 'Give the automation a name', color: 'red' });
      return;
    }
    if (isMarketing) {
      if (!templateId) {
        notifications.show({ message: 'Pick a marketing template to send', color: 'red' });
        return;
      }
      const body = { name: name.trim(), tags, templateId, timezone, schedule, audience, enabled };
      if (editing) updateMkt.mutate({ id: editing.id, body }, done);
      else createMkt.mutate(body, done);
      return;
    }
    // Deal automation (trigger-based email, or an activity)
    if (!trigger) {
      notifications.show({ message: 'Pick a trigger', color: 'red' });
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
    if (action === 'request_signature' && !config.signableDocumentTemplateId) {
      notifications.show({ message: 'Pick a document template to send for signature', color: 'red' });
      return;
    }
    const body = {
      name: name.trim(),
      tags,
      trigger,
      action,
      templateId: action === 'send_email' ? templateId ?? undefined : undefined,
      config,
      enabled: action === 'send_email' && !google?.mailbox ? false : enabled,
    };
    if (editing) update.mutate({ id: editing.id, body }, done);
    else create.mutate(body, done);
  };

  // Enabled gating: only deal email automations need a Gmail connection (marketing sends via Brevo).
  const emailBlocked = action === 'send_email' && kind === 'deal' && !google?.mailbox;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? 'Edit automation' : 'New automation'}
      size={isMarketing ? 'lg' : 'md'}
      centered
    >
      <Stack gap="sm">
        <TextInput
          label="Name"
          placeholder={isMarketing ? 'e.g. Monthly newsletter' : 'e.g. Thank-you after invoice sent'}
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />

        {/* Type drives the whole form — everything below depends on it */}
        <Select
          label="Type"
          description={
            kind === 'deal'
              ? 'Triggered by an event on a deal — sends to that deal’s contact, or creates an activity.'
              : 'A scheduled broadcast to an audience of contacts (sent from the workspace).'
          }
          data={[
            { value: 'deal', label: 'Deal — triggered' },
            { value: 'marketing', label: 'Marketing — scheduled' },
          ]}
          value={kind}
          onChange={(v) => setKind((v as AutomationKind) ?? 'deal')}
          allowDeselect={false}
          disabled={!!editing}
        />

        {isMarketing ? (
          <>
            <Select
              label="Send this template"
              required
              description="Marketing email templates only"
              placeholder={marketingTemplates.length === 0 ? 'Create a marketing template first' : 'Pick a template'}
              data={marketingTemplates.map((t) => ({ value: t.id, label: t.name }))}
              value={templateId}
              onChange={setTemplateId}
              renderOption={({ option }) => {
                const t = marketingTemplates.find((x) => x.id === option.value);
                return (
                  <Group gap={6} wrap="wrap" align="center">
                    <Text size="sm">{option.label}</Text>
                    {(t?.tags ?? []).map((tag) => (
                      <Badge key={tag} size="xs" variant="light" color="candango" style={{ textTransform: 'none' }}>
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                );
              }}
            />
            <Divider label="Schedule" labelPosition="left" />
            <ScheduleBuilder value={schedule} onChange={setSchedule} timezone={timezone} onTimezoneChange={setTimezone} />
            <Divider label="Audience" labelPosition="left" />
            <AudienceBuilder value={audience} onChange={setAudience} />
          </>
        ) : (
          <>
            {/* Do this (action) */}
            <Select
              label="Do this"
              required
              data={[
                { value: 'send_email', label: 'Send an email' },
                { value: 'create_activity', label: 'Create an activity' },
                { value: 'request_signature', label: 'Request a signature' },
              ]}
              value={action}
              onChange={(v) => setAction((v as 'send_email' | 'create_activity' | 'request_signature') ?? 'send_email')}
              allowDeselect={false}
            />
            {/* When (trigger) */}
            <Select
              label="When this happens"
              required
              data={triggers.map((t) => ({
                value: t.key,
                label: t.comingSoon ? `${t.label} (coming soon)` : t.label,
                disabled: t.comingSoon,
              }))}
              value={trigger}
              onChange={(v) => {
                setTrigger(v);
                setConfig({});
              }}
            />
            {def && (
              <Text size="xs" c="dimmed">
                {def.description}
              </Text>
            )}
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

            {action === 'send_email' ? (
              <Select
                label="Send this template"
                required
                description="Deal email templates only"
                placeholder={dealTemplates.length === 0 ? 'Create a deal template first' : 'Pick a template'}
                data={dealTemplates.map((t) => ({ value: t.id, label: t.name }))}
                value={templateId}
                onChange={setTemplateId}
                renderOption={({ option }) => {
                  const t = dealTemplates.find((x) => x.id === option.value);
                  return (
                    <Group gap={6} wrap="wrap" align="center">
                      <Text size="sm">{option.label}</Text>
                      {(t?.tags ?? []).map((tag) => (
                        <Badge key={tag} size="xs" variant="light" color="candango" style={{ textTransform: 'none' }}>
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  );
                }}
              />
            ) : action === 'request_signature' ? (
              <>
                <Select
                  label="Generate & send this document"
                  required
                  description="Sent to the deal's primary contact for signature"
                  placeholder={signableDocs.length === 0 ? 'Create a document template in Settings → Signatures' : 'Pick a document template'}
                  data={signableDocs.map((d) => ({ value: d.id, label: d.name }))}
                  value={(config.signableDocumentTemplateId as string) ?? null}
                  onChange={(v) => setCfg('signableDocumentTemplateId', v ?? undefined)}
                />
                <Switch
                  label="Email the signer now"
                  checked={config.sendEmail !== false}
                  onChange={(e) => setCfg('sendEmail', e.currentTarget.checked)}
                />
              </>
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
          </>
        )}

        <CreatableMultiSelect
          label="Tags"
          placeholder="e.g. Q3, VIP"
          options={allTags.map((t) => ({ value: t, label: t }))}
          value={tags}
          onChange={setTags}
          onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
          createVerb="Add"
          emptyText="Type to add a tag"
        />

        <Switch
          label="Enabled"
          description={
            emailBlocked
              ? 'Connect Google to enable deal email automations — it will be created but stay off until then.'
              : undefined
          }
          checked={enabled && !emailBlocked}
          onChange={(e) => setEnabled(e.currentTarget.checked)}
          disabled={emailBlocked}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<IconBolt size={16} />} onClick={submit} loading={pending}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
