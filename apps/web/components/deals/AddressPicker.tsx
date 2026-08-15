'use client';

import { useState } from 'react';
import { Anchor, Group, Paper, Stack, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import type { Address } from '@/components/deals/AddressFields';
import { AddressFields } from '@/components/deals/AddressFields';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { usePersonCreate } from '@/components/contacts/PersonCreateModal';
import { useAddDealParticipant, useCompanies, useCreatePerson, useCustomFields, useDeal, useDealParticipants } from '@/lib/api/hooks';

type Addr = Record<string, unknown> | null | undefined;
const asAddr = (a: Addr): Record<string, string> => (a ?? {}) as Record<string, string>;

function hasAddr(v: Address | Addr): boolean {
  const a = asAddr(v as Addr);
  return !!(a.name || a.line1 || a.line2 || a.city || a.state || a.postalCode || a.country);
}
/** One-line preview of an address. */
function summarize(v: Address | Addr): string {
  const a = asAddr(v as Addr);
  const cityLine = [a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(' · ');
}

/**
 * Bill To / Ship To — holds a **single** address. When empty, a picker offers existing addresses in
 * priority order: the deal's **address (custom) fields** → **participants** → the **company**; plus
 * **Enter a new address** (the shared form with Google Places autocomplete), and **quick-create** a
 * person (→ participant). Once set, only the address **card** shows (no input) with **Edit** (tweak)
 * and **Change** (pick another). No QuickBooks required.
 */
export function AddressPicker({
  label,
  placeholder,
  value,
  onChange,
  dealId,
  company,
}: {
  label: string;
  placeholder: string;
  value: Address;
  onChange: (v: Address) => void;
  dealId: string;
  company?: { id: string; name: string; address: Address } | null;
}) {
  const { data: participants = [] } = useDealParticipants(dealId);
  const { data: deal } = useDeal(dealId);
  const { data: companies = [] } = useCompanies();
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: companyFields = [] } = useCustomFields('company');
  const { data: personFields = [] } = useCustomFields('person');
  const createPerson = useCreatePerson();
  const addParticipant = useAddDealParticipant();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  // Full company record (for its address + address custom fields).
  const fullCompany = companies.find((c) => c.id === company?.id) ?? null;

  type Def = { key: string; type: string; label: string };
  type Opt = { value: string; label: string; description: string; name: string; addr: Addr };
  // Each `address`-type custom field with a value as an option. (People/companies have no built-in
  // address — addresses live in address custom fields.)
  const addrFields = (prefix: string, id: string, name: string, cfVals: Record<string, unknown>, defs: Def[], withName = true): Opt[] =>
    defs
      .filter((f) => f.type === 'address' && hasAddr(cfVals[f.key] as Addr))
      .map((f) => ({
        value: `${prefix}:${id}:f:${f.key}`,
        label: name ? `${name} · ${f.label}` : f.label,
        description: summarize(cfVals[f.key] as Addr),
        name: withName ? name : '',
        addr: cfVals[f.key] as Addr,
      }));

  // Existing addresses to offer, in priority order: the deal's own address fields → the company's
  // address fields → each participant's address fields.
  const options: Opt[] = [
    ...addrFields('deal', dealId, '', (deal?.customFields ?? {}) as Record<string, unknown>, dealFields, false),
    ...(fullCompany ? addrFields('company', fullCompany.id, fullCompany.name, fullCompany.customFields ?? {}, companyFields) : []),
    ...participants.flatMap((p) => addrFields('person', p.id, p.name, p.customFields ?? {}, personFields)),
  ];

  const apply = (optId: string | null) => {
    const o = options.find((x) => x.value === optId);
    if (!o) return;
    const a = asAddr(o.addr);
    onChange({ ...a, name: o.name || a.name || value?.name || '' });
    setPicking(false);
    setEditing(false);
  };

  const personCreate = usePersonCreate({
    linkLabel: company?.name,
    create: async ({ firstName, lastName, link }) => {
      const p = await createPerson.mutateAsync({ firstName, lastName, companyIds: link && company ? [company.id] : undefined });
      await addParticipant.mutateAsync({ dealId, personId: p.id });
      return { value: `person:${p.id}`, label: p.name };
    },
  });

  const has = hasAddr(value);
  const showPicker = (!has || picking) && !editing;

  return (
    <Stack gap={6}>
      {showPicker && (
        <>
          <CreatableSelect
            label={label}
            placeholder={placeholder}
            options={options}
            value={null}
            openOnFocus
            onChange={apply}
            onCreate={async (typed) => {
              const opt = await personCreate.prompt(typed);
              if (opt) {
                // New person: name only — open the form to add the address.
                onChange({ name: opt.label });
                setPicking(false);
                setEditing(true);
              }
              return opt;
            }}
          />
          <Anchor size="xs" onClick={() => { setEditing(true); setPicking(false); }}>
            Enter a new address
          </Anchor>
        </>
      )}
      {personCreate.modal}

      {has && !editing && !picking && (
        <Paper withBorder radius="md" p="xs">
          <Group gap={8} wrap="nowrap" align="flex-start">
            <IconMapPin size={15} color="var(--mantine-color-gray-6)" style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              {value?.name && <Text size="sm" fw={600}>{value.name}</Text>}
              {summarize(value) ? (
                <Text size="xs" c="dimmed">{summarize(value)}</Text>
              ) : (
                <Text size="xs" c="dimmed">No address on file</Text>
              )}
            </div>
            <Group gap="sm" wrap="nowrap">
              <Anchor size="xs" onClick={() => setEditing(true)}>Edit</Anchor>
              <Anchor size="xs" onClick={() => setPicking(true)}>Change</Anchor>
            </Group>
          </Group>
        </Paper>
      )}

      {editing && (
        <div>
          <AddressFields hideLabel withName={false} label={label} value={value} onChange={onChange} />
          <Group justify="flex-end" mt={4}>
            <Anchor size="xs" onClick={() => setEditing(false)}>Done</Anchor>
          </Group>
        </div>
      )}
    </Stack>
  );
}
