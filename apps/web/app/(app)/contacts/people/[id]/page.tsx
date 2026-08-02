'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Anchor,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBuilding,
  IconMail,
  IconMailOff,
  IconPhone,
} from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { CreatableMultiSelect } from '@/components/common/CreatableMultiSelect';
import { usePersonDetail, usePersons, useQuickbooksStatus, useUpdatePerson } from '@/lib/api/hooks';
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
  const { data: qb } = useQuickbooksStatus();
  const update = useUpdatePerson();

  const allTags = [...new Set(persons.flatMap((p) => p.tags ?? []))].sort((a, b) => a.localeCompare(b));

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

  const saveTags = (tags: string[]) =>
    update.mutate({ id: person.id, tags }, { onError: fail });

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

  return (
    <Stack gap="lg">
      <BackLink />

      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
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

      {/* Labels — moved out of Details into their own full-width bar */}
      <Card withBorder radius="md" padding="sm">
        <CreatableMultiSelect
          label="Labels"
          placeholder="Add labels"
          options={allTags.map((t) => ({ value: t, label: t }))}
          value={person.tags ?? []}
          onChange={saveTags}
          onCreate={async (t) => ({ value: t.trim(), label: t.trim() })}
          createVerb="Add"
          emptyText="Type to add a label"
        />
      </Card>

      <Group align="flex-start" gap="lg" wrap="wrap">
        {/* Left column: details + subscription */}
        <Stack gap="md" style={{ flex: '1 1 320px', minWidth: 300 }}>
          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="sm">
              Details
            </Text>
            <Stack gap="xs">
              <DetailRow icon={<IconMail size={16} />} label="Email">
                {person.email ? <Anchor href={`mailto:${person.email}`}>{person.email}</Anchor> : <Dim />}
              </DetailRow>
              <DetailRow icon={<IconPhone size={16} />} label="Phone">
                {person.phone ?? <Dim />}
              </DetailRow>
              <DetailRow icon={<IconBuilding size={16} />} label="Companies">
                {person.companies.length ? person.companies.map((c) => c.name).join(', ') : <Dim />}
              </DetailRow>
            </Stack>
          </Card>

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

        {/* Right column: deals + documents + messages */}
        <Stack gap="md" style={{ flex: '2 1 420px', minWidth: 320 }}>
          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="sm">
              Deals ({person.deals.length})
            </Text>
            <ContactDeals deals={person.deals} />
          </Card>

          {(qb?.connected || person.documents.length > 0) && (
            <Card withBorder radius="md" padding="md">
              <Text fw={600} mb="sm">
                Estimates &amp; invoices
              </Text>
              <ContactDocuments documents={person.documents} />
            </Card>
          )}

          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="sm">
              Recent messages
            </Text>
            <ContactMessages messages={person.messages} />
          </Card>
        </Stack>
      </Group>
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
