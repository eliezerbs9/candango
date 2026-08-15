'use client';

import Link from 'next/link';
import { Anchor, Badge, Group, Paper, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { IconBriefcase, IconReceipt, IconRefresh } from '@tabler/icons-react';
import { Money } from '@/components/primitives/Money';
import type { ContactDocument, DocumentSummary } from '@/lib/api/contacts';

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'teal',
  paid: 'teal',
  rejected: 'red',
  void: 'red',
  closed: 'gray',
};

/** A single estimate/invoice card. */
function DocCard({ d }: { d: ContactDocument }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap={6} wrap="nowrap" mb={4}>
        <Badge size="xs" variant="light" color={d.kind === 'invoice' ? 'grape' : 'cyan'} style={{ textTransform: 'none' }}>
          {d.kind === 'invoice' ? 'Invoice' : 'Estimate'}
        </Badge>
        <Badge size="xs" variant="light" color={STATUS_COLOR[d.status] ?? 'gray'} style={{ textTransform: 'none' }}>
          {d.status}
        </Badge>
      </Group>
      <Text size="sm" fw={600}>
        {d.docNumber ? `#${d.docNumber}` : '—'}
      </Text>
      <Text size="sm" fw={700} mt={4}>
        <Money value={d.total} currency={d.currency} />
      </Text>
    </Paper>
  );
}

/** One stat tile in the summary header. */
function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Text fw={700} fz="lg" lh={1.2}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </div>
  );
}

/** Stats header — same layout with or without QuickBooks; when connected, a sync + QuickBooks icon marks it as live-synced. */
function StatsHeader({ summary, jobs, connected }: { summary: DocumentSummary; jobs: number; connected: boolean }) {
  return (
    <Paper withBorder radius="md" p="md" bg="var(--mantine-color-default-hover)" style={{ position: 'relative' }}>
      {connected && (
        <Tooltip label="Synced from QuickBooks" withArrow>
          <Group gap={4} wrap="nowrap" c="dimmed" style={{ position: 'absolute', top: 8, right: 10 }}>
            <IconRefresh size={14} />
            <IconReceipt size={15} />
          </Group>
        </Tooltip>
      )}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Stat label="Jobs" value={jobs} />
        <Stat label="Estimates" value={summary.estimates} hint={`${summary.estimatesAccepted} accepted`} />
        <Stat
          label="Invoices"
          value={summary.invoices}
          hint={`${summary.invoicesPaid} paid · ${summary.invoicesUnpaid} unpaid`}
        />
        <Stat label="Total invoiced" value={<Money value={summary.invoicesTotal} currency={summary.currency} />} />
      </SimpleGrid>
    </Paper>
  );
}

/**
 * Estimates + invoices across a contact's deals: a stats header (same layout
 * whether or not QuickBooks is connected — the sync/QuickBooks icons only mark
 * that it's live-synced), then the documents grouped by job (deal).
 */
export function ContactDocuments({
  documents = [],
  summary,
  connected = false,
}: {
  documents?: ContactDocument[];
  summary?: DocumentSummary;
  connected?: boolean;
}) {
  const groups = groupByJob(documents);

  return (
    <Stack gap="lg">
      {summary && <StatsHeader summary={summary} jobs={groups.length} connected={connected} />}

      {documents.length === 0 ? (
        <Text size="sm" c="dimmed">
          No estimates or invoices yet.
        </Text>
      ) : (
        <Stack gap="lg">
          {groups.map((g) => (
            <div key={g.dealId ?? 'unassigned'}>
              <Group gap={6} mb="xs" wrap="nowrap">
                <IconBriefcase size={15} color="var(--mantine-color-dimmed)" />
                {g.dealId ? (
                  <Anchor component={Link} href={`/deals/${g.dealId}`} size="sm" fw={600}>
                    {g.dealTitle ?? 'Untitled deal'}
                  </Anchor>
                ) : (
                  <Text size="sm" fw={600} c="dimmed">
                    Not linked to a deal
                  </Text>
                )}
                <Badge size="xs" variant="light" color="gray">
                  {g.docs.length}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
                {g.docs.map((d) => (
                  <DocCard key={`${d.kind}-${d.id}`} d={d} />
                ))}
              </SimpleGrid>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

type JobGroup = { dealId: string | null; dealTitle: string | null; docs: ContactDocument[]; latest: string };

/** Group documents by deal (job); groups ordered newest-first by their most-recent doc. */
function groupByJob(documents: ContactDocument[]): JobGroup[] {
  const byDeal = new Map<string, JobGroup>();
  for (const d of documents) {
    const key = d.dealId ?? '__none__';
    const existing = byDeal.get(key);
    if (existing) {
      existing.docs.push(d);
      if (d.at > existing.latest) existing.latest = d.at;
    } else {
      byDeal.set(key, { dealId: d.dealId, dealTitle: d.dealTitle, docs: [d], latest: d.at });
    }
  }
  return [...byDeal.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}
