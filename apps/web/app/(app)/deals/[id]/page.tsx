'use client';

import { Card, Divider, Grid, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { usePersonCreate } from '@/components/contacts/PersonCreateModal';
import { DealTimeline } from '@/components/deals/DealTimeline';
import { useDealCtx } from '@/components/deals/DealContext';
import { useCompanies, useCreateCompany, useCreatePerson, useDealEstimates, usePersons } from '@/lib/api/hooks';

export default function DealOverviewPage() {
  const { deal, form, setForm, saveBar } = useDealCtx();
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const { data: dealEstimates = [] } = useDealEstimates(deal.id);
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();

  const personCreate = usePersonCreate({
    linkLabel: form.companyId ? companies.find((c) => c.id === form.companyId)?.name : undefined,
    create: async ({ firstName, lastName, link }) => {
      const p = await createPerson.mutateAsync({
        firstName,
        lastName,
        companyIds: link && form.companyId ? [form.companyId] : undefined,
      });
      return { value: p.id, label: p.name };
    },
  });

  return (
    <>
      {personCreate.modal}
      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <DealTimeline dealId={deal.id} />
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
              <Divider label="People" labelPosition="left" />
              <CreatableSelect
                label="Company"
                placeholder="Search or create a company"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                value={form.companyId}
                onChange={(v) => setForm({ ...form, companyId: v })}
                onCreate={async (name) => {
                  // Link the deal's contact as the new company's primary contact, so it never lands without one.
                  const c = await createCompany.mutateAsync(form.primaryPersonId ? { name, contactIds: [form.primaryPersonId], primaryContactId: form.primaryPersonId } : { name });
                  return { value: c.id, label: c.name };
                }}
              />
              <CreatableSelect
                label="Primary contact"
                placeholder="Search or create a contact"
                options={persons.map((p) => ({ value: p.id, label: p.name }))}
                value={form.primaryPersonId}
                onChange={(v) => setForm({ ...form, primaryPersonId: v })}
                onCreate={personCreate.prompt}
              />
              {saveBar}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}
