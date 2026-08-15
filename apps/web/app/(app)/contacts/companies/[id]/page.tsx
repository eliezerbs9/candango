'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ActionIcon, Anchor, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconMail, IconPhone, IconPlus, IconReceipt, IconStar, IconWorld, IconX } from '@tabler/icons-react';
import type { ApiCompany } from '@/lib/api/contacts';
import { ApiError } from '@/lib/api/client';
import { LabelsField } from '@/components/common/LabelsField';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { usePersonCreate } from '@/components/contacts/PersonCreateModal';
import { useCompanies, useCompanyDetail, useCreatePerson, useCustomFields, usePersons, useQuickbooksStatus, useUpdateCompany } from '@/lib/api/hooks';
import { CustomFieldsEditor } from '@/components/deals/CustomFieldsEditor';
import { EditableField } from '@/components/contacts/EditableField';
import { SaveStatus } from '@/components/proposals/SaveStatus';
import { useAutosave } from '@/lib/useAutosave';
import { ContactDeals } from '@/components/contacts/ContactDeals';
import { ContactDocuments } from '@/components/contacts/ContactDocuments';
import { ContactMessages } from '@/components/contacts/ContactMessages';
import { ContactStats } from '@/components/contacts/ContactStats';
import { PersonMiniCard } from '@/components/contacts/PersonMiniCard';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading } = useCompanyDetail(id);
  const { data: companies = [] } = useCompanies();
  const { data: companyFields = [] } = useCustomFields('company');
  const { data: qb } = useQuickbooksStatus();
  const update = useUpdateCompany();

  const allTags = [...new Set(companies.flatMap((c) => c.tags ?? []))].sort((a, b) => a.localeCompare(b));

  const [cf, setCf] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (company) setCf(company.customFields ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);
  const cfStatus = useAutosave(cf, (v) => update.mutateAsync({ id: id, customFields: v }), !!company);

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }
  if (!company) {
    return (
      <Stack gap="md">
        <BackLink />
        <Text c="dimmed">This company no longer exists.</Text>
      </Stack>
    );
  }

  const saveTags = (tags: string[]) => update.mutate({ id: company.id, tags }, { onError: fail });
  const showDocs = qb?.connected || (company.documents?.length ?? 0) > 0;

  return (
    <Stack gap="lg">
      <BackLink />

      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <div>
          <Text fw={700} fz="xl">
            {company.name}
          </Text>
          {company.domain && (
            <Anchor href={`https://${company.domain}`} target="_blank" rel="noreferrer" size="sm" c="dimmed">
              {company.domain}
            </Anchor>
          )}
        </div>
        <ContactStats deals={company.deals} />
      </Group>

      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          {showDocs && <Tabs.Tab value="docs">Estimates &amp; invoices</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="overview" pt="lg">
          <Stack gap="lg">
            <div>
              <Text size="sm" fw={500} mb={6}>
                Labels
              </Text>
              <LabelsField value={company.tags ?? []} options={allTags} onChange={saveTags} />
            </div>

            <Group align="stretch" gap="lg" wrap="wrap">
              <Stack gap="md" style={{ flex: '1 1 320px', minWidth: 300 }}>
                <Card withBorder radius="md" padding="md">
                  <Text fw={600} mb="sm">
                    Details
                  </Text>
                  <Stack gap="xs">
                    <EditableField
                      icon={<IconWorld size={16} />}
                      label="Domain"
                      placeholder="example.com"
                      value={company.domain ?? ''}
                      display={company.domain ? <Anchor href={`https://${company.domain}`} target="_blank" rel="noreferrer">{company.domain}</Anchor> : undefined}
                      onSave={(v) => update.mutate({ id: company.id, domain: v }, { onError: fail })}
                    />
                    <EditableField
                      icon={<IconMail size={16} />}
                      label="Email"
                      type="email"
                      placeholder="info@example.com"
                      value={company.email ?? ''}
                      display={company.email ? <Anchor href={`mailto:${company.email}`}>{company.email}</Anchor> : undefined}
                      onSave={(v) => update.mutate({ id: company.id, email: v }, { onError: fail })}
                    />
                    <EditableField
                      icon={<IconPhone size={16} />}
                      label="Phone"
                      type="tel"
                      value={company.phone ?? ''}
                      onSave={(v) => update.mutate({ id: company.id, phone: v }, { onError: fail })}
                    />
                    {company.qbCustomerId && (
                      <DetailRow icon={<IconReceipt size={16} />} label="QuickBooks customer ID">
                        {company.qbCustomerId}
                      </DetailRow>
                    )}
                  </Stack>
                </Card>

                {companyFields.length > 0 && (
                  <Card withBorder radius="md" padding="md">
                    <Group justify="space-between" mb="xs">
                      <Text fw={600}>Custom fields</Text>
                      <SaveStatus status={cfStatus} />
                    </Group>
                    <CustomFieldsEditor
                      entity="company"
                      values={cf}
                      onChange={(k, v) => setCf((p) => ({ ...p, [k]: v }))}
                      onCommit={(k, v) => setCf((p) => ({ ...p, [k]: v }))}
                    />
                  </Card>
                )}

                <CompanyContactsCard company={company} onSave={(body) => update.mutate({ id: company.id, ...body }, { onError: fail })} />
              </Stack>

              <Stack gap="md" style={{ flex: '2 1 420px', minWidth: 320 }}>
                <Card withBorder radius="md" padding="md">
                  <Text fw={600} mb="sm">
                    Deals ({company.deals.length})
                  </Text>
                  <ContactDeals deals={company.deals} />
                </Card>

                <Card withBorder radius="md" padding="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 260 }}>
                  <Text fw={600} mb="sm">
                    Recent messages
                  </Text>
                  <ContactMessages messages={company.messages} fill />
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
              <ContactDocuments documents={company.documents} summary={company.documentsSummary} connected={!!qb?.connected} />
            </Card>
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}

/** Editable list of a company's contacts: set each one's role and mark the primary contact. */
function CompanyContactsCard({
  company,
  onSave,
}: {
  company: ApiCompany;
  onSave: (body: { contactTitles?: Record<string, string>; primaryContactId?: string | null; contactIds?: string[] }) => void;
}) {
  const { data: persons = [] } = usePersons();
  const createPerson = useCreatePerson();
  const [titles, setTitles] = useState<Record<string, string>>(() => Object.fromEntries(company.contacts.map((p) => [p.id, p.title ?? ''])));
  const [adding, setAdding] = useState(false);
  const personById = new Map(persons.map((p) => [p.id, p]));

  const ids = company.contacts.map((p) => p.id);
  const addContact = (personId: string | null) => {
    if (personId && !ids.includes(personId)) onSave({ contactIds: [...ids, personId] });
  };
  const removeContact = (personId: string) => onSave({ contactIds: ids.filter((x) => x !== personId) });

  // Quick-create a bare person; addContact() links them to the company (single link path).
  const personCreate = usePersonCreate({
    create: async ({ firstName, lastName }) => {
      const p = await createPerson.mutateAsync({ firstName, lastName });
      return { value: p.id, label: p.name };
    },
  });

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Contacts &amp; roles</Text>
        {company.contacts.length > 0 && (
          <Text size="xs" c="dimmed">
            <IconStar size={11} style={{ verticalAlign: '-1px' }} /> = primary
          </Text>
        )}
      </Group>
      {company.contacts.length === 0 && !adding && (
        <Text size="sm" c="dimmed" mb="sm">
          No contacts yet.
        </Text>
      )}

      {company.contacts.length > 0 && (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mb="sm">
          {company.contacts.map((c) => {
            const p = personById.get(c.id);
            const isPrimary = company.primaryContactId === c.id;
            return (
              <PersonMiniCard
                key={c.id}
                id={c.id}
                name={c.name}
                isPrimary={isPrimary}
                primaryTooltip={isPrimary ? 'Primary — click to unset' : 'Set as primary'}
                onSetPrimary={() => onSave({ primaryContactId: isPrimary ? null : c.id })}
                onRemove={() => removeContact(c.id)}
              >
                {p?.email && (
                  <Text size="xs" c="dimmed" lineClamp={1}>{p.email}</Text>
                )}
                <TextInput
                  size="xs"
                  mt={4}
                  placeholder="Role"
                  value={titles[c.id] ?? ''}
                  onChange={(e) => { const v = e.currentTarget.value; setTitles((t) => ({ ...t, [c.id]: v })); }}
                  onBlur={() => onSave({ contactTitles: titles })}
                />
              </PersonMiniCard>
            );
          })}
        </SimpleGrid>
      )}

      {adding ? (
        <Group gap={4} wrap="nowrap" align="flex-start">
          <div style={{ flex: 1 }}>
            <CreatableSelect
              label=""
              placeholder="Search or create a person"
              openOnFocus
              options={persons.filter((p) => !ids.includes(p.id)).map((p) => ({ value: p.id, label: p.name }))}
              value={null}
              onChange={(v) => { addContact(v); setAdding(false); }}
              onCreate={async (name) => {
                const opt = await personCreate.prompt(name);
                if (opt) { addContact(opt.value); setAdding(false); }
                return opt;
              }}
            />
          </div>
          <ActionIcon variant="subtle" color="gray" aria-label="Cancel" onClick={() => setAdding(false)}>
            <IconX size={15} />
          </ActionIcon>
        </Group>
      ) : (
        <Button variant="subtle" size="xs" leftSection={<IconPlus size={13} />} onClick={() => setAdding(true)}>
          Add person
        </Button>
      )}
      {personCreate.modal}
    </Card>
  );
}

function BackLink() {
  return (
    <Anchor component={Link} href="/contacts/companies" c="dimmed" size="sm">
      <Group gap={4} wrap="nowrap">
        <IconArrowLeft size={14} /> Companies
      </Group>
    </Anchor>
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
