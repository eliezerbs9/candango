'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ActionIcon,
  Anchor,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Switch,
  Tabs,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBuilding,
  IconCheck,
  IconMail,
  IconMailOff,
  IconPencil,
  IconPhone,
  IconReceipt,
} from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { LabelsField } from '@/components/common/LabelsField';
import { useCompanies, useCreateCompany, useCustomFields, usePersonDetail, usePersons, useQuickbooksStatus, useUpdatePerson } from '@/lib/api/hooks';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { EditableField } from '@/components/contacts/EditableField';
import { SaveStatus } from '@/components/proposals/SaveStatus';
import { useAutosave } from '@/lib/useAutosave';
import { ContactMessages } from '@/components/contacts/ContactMessages';
import { ContactDeals } from '@/components/contacts/ContactDeals';
import { ContactDocuments } from '@/components/contacts/ContactDocuments';
import { ContactStats } from '@/components/contacts/ContactStats';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading } = usePersonDetail(id);
  const { data: persons = [] } = usePersons();
  const { data: personFields = [] } = useCustomFields('person');
  const { data: qb } = useQuickbooksStatus();
  const update = useUpdatePerson();

  const allTags = [...new Set(persons.flatMap((p) => p.tags ?? []))].sort((a, b) => a.localeCompare(b));

  // Custom-field values edited inline and autosaved.
  const [cf, setCf] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (person) setCf(person.customFields ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id]);
  const cfStatus = useAutosave(cf, (v) => update.mutateAsync({ id: id, customFields: v }), !!person);

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }
  if (!person) {
    return (
      <Stack gap="md">
        <BackLink />
        <Text c="dimmed">This contact no longer exists.</Text>
      </Stack>
    );
  }

  const saveTags = (tags: string[]) => update.mutate({ id: person.id, tags }, { onError: fail });

  const toggleSubscribed = (emailSubscribed: boolean) =>
    update.mutate(
      { id: person.id, emailSubscribed },
      {
        onSuccess: () =>
          notifications.show({
            message: emailSubscribed ? 'Contact re-subscribed to marketing emails' : 'Contact opted out of marketing emails',
            color: 'green',
          }),
        onError: fail,
      },
    );

  const showDocs = qb?.connected || (person.documents?.length ?? 0) > 0;

  return (
    <Stack gap="lg">
      <BackLink />

      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <div>
          <Text fw={700} fz="xl">
            {person.name}
          </Text>
          {person.companies.length > 0 && (
            <Text size="sm" c="dimmed">
              {person.companies.map((c, i) => (
                <span key={c.id}>
                  {i > 0 ? ', ' : ''}
                  <Anchor component={Link} href={`/contacts/companies/${c.id}`}>
                    {c.name}
                  </Anchor>
                </span>
              ))}
            </Text>
          )}
        </div>
        <ContactStats deals={person.deals} />
      </Group>

      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          {showDocs && <Tabs.Tab value="docs">Estimates &amp; invoices</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <Stack gap="lg">
            {/* Labels — pills + discrete add (panel, no card border) */}
            <div>
              <Text size="sm" fw={500} mb={6}>
                Labels
              </Text>
              <LabelsField value={person.tags ?? []} options={allTags} onChange={saveTags} />
            </div>

            <Group align="stretch" gap="lg" wrap="wrap">
              {/* Left: system fields + custom fields + subscription */}
              <Stack gap="md" style={{ flex: '1 1 320px', minWidth: 300 }}>
                <Card withBorder radius="md" padding="md">
                  <Text fw={600} mb="sm">
                    Details
                  </Text>
                  <Stack gap="xs">
                    <EditableField
                      icon={<IconMail size={16} />}
                      label="Email"
                      type="email"
                      placeholder="name@example.com"
                      value={person.email ?? ''}
                      display={person.email ? <Anchor href={`mailto:${person.email}`}>{person.email}</Anchor> : undefined}
                      onSave={(v) => update.mutate({ id: person.id, email: v }, { onError: fail })}
                    />
                    <EditableField
                      icon={<IconPhone size={16} />}
                      label="Phone"
                      type="tel"
                      value={person.phone ?? ''}
                      onSave={(v) => update.mutate({ id: person.id, phone: v }, { onError: fail })}
                    />
                    <CompaniesRow
                      person={person}
                      onSave={(companyIds) => update.mutate({ id: person.id, companyIds }, { onError: fail })}
                    />
                    {person.qbCustomerId && (
                      <DetailRow icon={<IconReceipt size={16} />} label="QuickBooks customer ID">
                        {person.qbCustomerId}
                      </DetailRow>
                    )}
                  </Stack>
                </Card>

                {personFields.length > 0 && (
                  <Card withBorder radius="md" padding="md">
                    <Group justify="space-between" mb="xs">
                      <Text fw={600}>Custom fields</Text>
                      <SaveStatus status={cfStatus} />
                    </Group>
                    <CustomFieldsEditor
                      entity="person"
                      values={cf}
                      onChange={(k, v) => setCf((p) => ({ ...p, [k]: v }))}
                      onCommit={(k, v) => setCf((p) => ({ ...p, [k]: v }))}
                    />
                  </Card>
                )}

                <Card withBorder radius="md" padding="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon variant="light" color={person.emailSubscribed ? 'teal' : 'gray'} radius="md">
                        {person.emailSubscribed ? <IconMail size={16} /> : <IconMailOff size={16} />}
                      </ThemeIcon>
                      <div>
                        <Text fw={600}>Marketing emails</Text>
                        <Text size="xs" c="dimmed">
                          {person.emailSubscribed
                            ? 'Subscribed — included in marketing sends.'
                            : `Opted out${person.emailUnsubscribedAt ? ` on ${new Date(person.emailUnsubscribedAt).toLocaleDateString()}` : ''}. Transactional emails still send.`}
                        </Text>
                      </div>
                    </Group>
                    <Switch
                      checked={person.emailSubscribed}
                      onChange={(e) => toggleSubscribed(e.currentTarget.checked)}
                      aria-label="Toggle marketing email subscription"
                    />
                  </Group>
                </Card>
              </Stack>

              {/* Right: deals + messages */}
              <Stack gap="md" style={{ flex: '2 1 420px', minWidth: 320 }}>
                <Card withBorder radius="md" padding="md">
                  <Text fw={600} mb="sm">
                    Deals ({person.deals.length})
                  </Text>
                  <ContactDeals deals={person.deals} />
                </Card>

                <Card withBorder radius="md" padding="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 260 }}>
                  <Text fw={600} mb="sm">
                    Recent messages
                  </Text>
                  <ContactMessages messages={person.messages} fill />
                </Card>
              </Stack>
            </Group>
          </Stack>
        </Tabs.Panel>

        {showDocs && (
          <Tabs.Panel value="docs" pt="lg">
            <Card withBorder radius="md" padding="md">
              <Text fw={600} mb="sm">
                Estimates &amp; invoices
              </Text>
              <ContactDocuments documents={person.documents} summary={person.documentsSummary} connected={!!qb?.connected} />
            </Card>
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}

function BackLink() {
  return (
    <Anchor component={Link} href="/contacts/people" c="dimmed" size="sm">
      <Group gap={4} wrap="nowrap">
        <IconArrowLeft size={14} /> People
      </Group>
    </Anchor>
  );
}

/** Companies row: read-first (names + pencil) → editable multi-select of companies. */
function CompaniesRow({ person, onSave }: { person: { companies: { id: string; name: string }[] }; onSave: (ids: string[]) => void }) {
  const { data: companies = [] } = useCompanies();
  const createCompany = useCreateCompany();
  const [editing, setEditing] = useState(false);
  const [ids, setIds] = useState<string[]>(person.companies.map((c) => c.id));
  const done = () => {
    setEditing(false);
    onSave(ids);
  };
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" color="gray" radius="md" size="md">
        <IconBuilding size={16} />
      </ThemeIcon>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="xs" c="dimmed">
          Companies
        </Text>
        {editing ? (
          <Group gap={4} wrap="nowrap" align="flex-start">
            <div style={{ flex: 1 }}>
              <CreatableMultiSelect
                label=""
                placeholder="Search or create companies"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                value={ids}
                onChange={setIds}
                onCreate={async (n) => {
                  const c = await createCompany.mutateAsync({ name: n.trim() });
                  return { value: c.id, label: c.name };
                }}
                createVerb="Add"
                emptyText="Type to add a company"
              />
            </div>
            <ActionIcon size="xs" variant="subtle" color="teal" aria-label="Save" onClick={done}>
              <IconCheck size={13} />
            </ActionIcon>
          </Group>
        ) : (
          <Group gap={6} wrap="nowrap">
            <Text size="sm" component="div" style={{ minWidth: 0 }}>
              {person.companies.length ? person.companies.map((c) => c.name).join(', ') : <Text span c="dimmed">—</Text>}
            </Text>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              aria-label="Edit companies"
              onClick={() => {
                setIds(person.companies.map((c) => c.id));
                setEditing(true);
              }}
            >
              <IconPencil size={12} />
            </ActionIcon>
          </Group>
        )}
      </div>
    </Group>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" color="gray" radius="md" size="md">
        {icon}
      </ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="sm" component="div">
          {children}
        </Text>
      </div>
    </Group>
  );
}

const Dim = () => (
  <Text span c="dimmed">
    —
  </Text>
);
