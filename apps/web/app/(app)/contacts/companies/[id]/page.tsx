'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Anchor, Card, Center, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPhone, IconReceipt, IconUsers, IconWorld } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { useCompanies, useCompanyDetail, useQuickbooksStatus, useUpdateCompany } from '@/lib/api/hooks';
import { ContactDeals } from '@/components/contacts/ContactDeals';
import { ContactDocuments } from '@/components/contacts/ContactDocuments';
import { ContactMessages } from '@/components/contacts/ContactMessages';
import { ContactStats } from '@/components/contacts/ContactStats';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading } = useCompanyDetail(id);
  const { data: companies = [] } = useCompanies();
  const { data: qb } = useQuickbooksStatus();
  const update = useUpdateCompany();

  const allTags = [...new Set(companies.flatMap((c) => c.tags ?? []))].sort((a, b) => a.localeCompare(b));

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

  return (
    <Stack gap="lg">
      <BackLink />

      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
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

      {/* Labels — moved into their own full-width bar */}
      <Card withBorder radius="md" padding="sm">
        <CreatableMultiSelect
          label="Labels"
          placeholder="Add labels"
          options={allTags.map((t) => ({ value: t, label: t }))}
          value={company.tags ?? []}
          onChange={saveTags}
          onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
          createVerb="Add"
          emptyText="Type to add a label"
        />
      </Card>

      <Group align="flex-start" gap="lg" wrap="wrap">
        <Stack gap="md" style={{ flex: '1 1 320px', minWidth: 300 }}>
          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="sm">
              Details
            </Text>
            <Stack gap="xs">
              <DetailRow icon={<IconWorld size={16} />} label="Domain">
                {company.domain ?? <Dim />}
              </DetailRow>
              <DetailRow icon={<IconPhone size={16} />} label="Phone">
                {company.phone ?? <Dim />}
              </DetailRow>
              <DetailRow icon={<IconUsers size={16} />} label="Contacts">
                {company.contacts.length ? (
                  <Group gap={4}>
                    {company.contacts.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 ? ', ' : ''}
                        <Anchor component={Link} href={`/contacts/people/${p.id}`}>
                          {p.name}
                        </Anchor>
                      </span>
                    ))}
                  </Group>
                ) : (
                  <Dim />
                )}
              </DetailRow>
              {company.qbCustomerId && (
                <DetailRow icon={<IconReceipt size={16} />} label="QuickBooks customer ID">
                  {company.qbCustomerId}
                </DetailRow>
              )}
            </Stack>
          </Card>
        </Stack>

        <Stack gap="md" style={{ flex: '2 1 420px', minWidth: 320 }}>
          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="sm">
              Deals ({company.deals.length})
            </Text>
            <ContactDeals deals={company.deals} />
          </Card>

          {(qb?.connected || (company.documents?.length ?? 0) > 0) && (
            <Card withBorder radius="md" padding="md">
              <Text fw={600} mb="sm">
                Estimates &amp; invoices
              </Text>
              <ContactDocuments documents={company.documents} />
            </Card>
          )}

          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="sm">
              Recent messages
            </Text>
            <ContactMessages messages={company.messages} />
          </Card>
        </Stack>
      </Group>
    </Stack>
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
