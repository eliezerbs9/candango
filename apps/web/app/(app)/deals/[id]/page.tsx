'use client';

import { Alert, Anchor, Card, Divider, Grid, NumberInput, Stack, TagsInput, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { ClientPicker } from '@/components/deals/ClientPicker';
import { DealTimeline } from '@/components/deals/DealTimeline';
import { useDealCtx } from '@/components/deals/DealContext';
import { useAddDealParticipant, useDealEstimates, useDealParticipants, useRemoveDealParticipant } from '@/lib/api/hooks';

export default function DealOverviewPage() {
  const { deal, form, setForm, saveBar } = useDealCtx();
  // Desktop only: match the activities column height to the Details column and scroll inside it.
  const isDesktop = useMediaQuery('(min-width: 62em)');
  const { data: dealEstimates = [] } = useDealEstimates(deal.id);
  const { data: participants = [] } = useDealParticipants(deal.id);
  const addParticipant = useAddDealParticipant();
  const removeParticipant = useRemoveDealParticipant();

  // Extra participants (rows in DealParticipant) — the derived primary/company-primary are handled by ClientPicker.
  const extraParticipantIds = participants.filter((p) => p.source === 'participant').map((p) => p.id);
  // People linked via a person-type custom field — always shown as (non-removable) participants.
  const derivedParticipantIds = participants.filter((p) => p.source === 'field').map((p) => p.id);
  const onParticipantsChange = (ids: string[]) => {
    for (const personId of ids.filter((id) => !extraParticipantIds.includes(id))) addParticipant.mutate({ dealId: deal.id, personId });
    for (const personId of extraParticipantIds.filter((id) => !ids.includes(id))) removeParticipant.mutate({ dealId: deal.id, personId });
  };

  // A deal already linked for billing: changing its company/contact is allowed but WON'T move the
  // existing billing account, so we warn (no hard lock) and point to Estimates & invoices.
  const linked = !!deal.qbSubcustomerId;
  const clientChanged = linked && (form.companyId !== deal.companyId || form.primaryPersonId !== deal.primaryPersonId);

  return (
    <Grid gutter="lg" align="stretch">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <DealTimeline dealId={deal.id} fill={!!isDesktop} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm">
            <Text fw={600}>Details</Text>
            <TextInput label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} />
            <NumberInput
              label="Value (USD)"
              prefix="$"
              thousandSeparator=","
              min={0}
              value={form.value}
              onChange={(v) => setForm({ ...form, value: v })}
              disabled={dealEstimates.length > 0}
              description={dealEstimates.length > 0 ? 'From the estimates counted below — edit those to change the value.' : undefined}
            />
            <TextInput
              type="date"
              label="Expected close"
              value={form.expectedCloseDate}
              onChange={(e) => setForm({ ...form, expectedCloseDate: e.currentTarget.value })}
            />
            <TagsInput
              label="Labels"
              placeholder="Add labels"
              value={form.tags}
              onChange={(tags) => setForm({ ...form, tags })}
            />
            <Divider label="Client" labelPosition="left" />
            <ClientPicker
              value={{ companyId: form.companyId, primaryPersonId: form.primaryPersonId }}
              onChange={(v) => setForm({ ...form, companyId: v.companyId, primaryPersonId: v.primaryPersonId })}
              participantIds={extraParticipantIds}
              onParticipantsChange={onParticipantsChange}
              derivedIds={derivedParticipantIds}
            />
            {clientChanged && (
              <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />} p="sm">
                <Text size="sm">
                  This deal already has a billing account. Changing the company or contact here won’t update that
                  account — review it under{' '}
                  <Anchor component={Link} href={`/deals/${deal.id}/estimates`}>
                    Estimates &amp; invoices
                  </Anchor>
                  .
                </Text>
              </Alert>
            )}
            {saveBar}
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
