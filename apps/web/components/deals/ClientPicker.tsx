'use client';

import { useMemo } from 'react';
import { Group, Stack, Text } from '@mantine/core';
import { IconMail, IconPhone, IconStar } from '@tabler/icons-react';
import type { ApiPerson } from '@/lib/api/contacts';
import { CreatableSelect } from '@/components/common/CreatableSelect';
import { PersonMiniCard } from '@/components/contacts/PersonMiniCard';
import { usePersonCreate } from '@/components/contacts/PersonCreateModal';
import { useCompanies, useCreateCompany, useCreatePerson, usePersons } from '@/lib/api/hooks';

export type ClientValue = { companyId: string | null; primaryPersonId: string | null };

/**
 * The deal's client, no tabs: a **Company** (optional) + a **Participants** list. The deal's
 * **primary contact** is one of the participants — marked with the ★ on its card (there's no
 * separate primary dropdown). A deal always has a primary: the first person added becomes it,
 * and removing the primary hands it to another participant. Picking a company adds its primary
 * contact as a participant. Each card shows where the person comes from (their company, or that
 * they're a company's primary). Works with or without QuickBooks.
 */
export function ClientPicker({
  value,
  onChange,
  participantIds,
  onParticipantsChange,
  derivedIds = [],
}: {
  value: ClientValue;
  onChange: (v: ClientValue) => void;
  participantIds: string[];
  onParticipantsChange: (ids: string[]) => void;
  /** Extra non-removable participants derived elsewhere (e.g. people linked via a person-type field). */
  derivedIds?: string[];
}) {
  const { data: companies = [] } = useCompanies();
  const { data: persons = [] } = usePersons();
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();

  const company = companies.find((c) => c.id === value.companyId);
  // A company with contacts always has a primary — fall back to its first contact if the backend
  // hasn't set one yet. Used only to LABEL the card ("<Company> primary"), not to pick the deal primary.
  const companyPrimaryId = company?.primaryContactId ?? company?.contacts[0]?.id ?? null;
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  // personId → the company it's the PRIMARY contact of (shown on the card + in suggestions).
  const primaryOfCompany = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) if (c.primaryContactId) m.set(c.primaryContactId, c.name);
    return m;
  }, [companies]);

  const createContact = async ({ firstName, lastName, link }: { firstName: string; lastName: string; link: boolean }) => {
    const p = await createPerson.mutateAsync({
      firstName,
      lastName,
      companyIds: link && value.companyId ? [value.companyId] : undefined,
    });
    return { value: p.id, label: p.name };
  };
  const participantCreate = usePersonCreate({ linkLabel: company?.name, create: createContact });

  const toOption = (p: ApiPerson) => ({ value: p.id, label: p.name, description: primaryOfCompany.get(p.id) });

  // Everyone shown as a participant, deduped: deal primary + the company's primary + extra
  // participants + field-linked. The company primary and field-linked people aren't removable.
  const allIds = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (id?: string | null) => {
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    };
    push(value.primaryPersonId);
    push(companyPrimaryId);
    participantIds.forEach(push);
    derivedIds.forEach(push);
    return out;
  }, [value.primaryPersonId, companyPrimaryId, participantIds, derivedIds]);
  const takenIds = useMemo(() => new Set(allIds), [allIds]);
  const fixedIds = useMemo(
    () => new Set([companyPrimaryId, ...derivedIds].filter((x): x is string => !!x)),
    [companyPrimaryId, derivedIds],
  );

  // Participant suggestions: the company's own contacts first (its primary at the very top).
  const participantOptions = useMemo(() => {
    const opts = persons.filter((p) => !takenIds.has(p.id)).map(toOption);
    if (!value.companyId) return opts;
    const contactIds = new Set(company?.contacts.map((c) => c.id) ?? []);
    const rank = (id: string) => (id === companyPrimaryId ? 0 : contactIds.has(id) ? 1 : 2);
    return [...opts].sort((a, b) => rank(a.value) - rank(b.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons, takenIds, value.companyId, company, companyPrimaryId, primaryOfCompany]);

  const pickCompany = (companyId: string | null) => {
    const next = companies.find((c) => c.id === companyId);
    const nextPrimary = next?.primaryContactId ?? next?.contacts[0]?.id ?? null;
    // Keep the deal primary if set, else the company's primary becomes it. The company primary
    // shows as a (non-removable) participant card either way.
    onChange({ companyId, primaryPersonId: value.primaryPersonId || nextPrimary });
  };

  const setPrimary = (id: string) => onChange({ ...value, primaryPersonId: id });

  const addParticipant = (id: string | null) => {
    if (!id || allIds.includes(id)) return;
    onParticipantsChange([...participantIds, id]);
    if (!value.primaryPersonId) onChange({ ...value, primaryPersonId: id }); // first one added is the primary
  };

  const removeParticipant = (id: string) => {
    if (fixedIds.has(id)) return; // company primary / field-linked → not removable here
    const nextParticipants = participantIds.filter((x) => x !== id);
    if (id === value.primaryPersonId) {
      // A deal always keeps a primary — hand it to another shown person, else clear it.
      onChange({ ...value, primaryPersonId: allIds.find((x) => x !== id) ?? null });
    }
    if (participantIds.includes(id)) onParticipantsChange(nextParticipants);
  };

  // Card subtitle: where the person comes from — a company's primary, or their company affiliation.
  const originLabel = (id: string) => {
    if (id === companyPrimaryId) return `${company?.name ?? 'Company'} primary`;
    if (primaryOfCompany.has(id)) return `${primaryOfCompany.get(id)} primary`;
    if (derivedIds.includes(id)) return 'Linked in a field';
    return personById.get(id)?.companies[0]?.name ?? 'Participant';
  };

  return (
    <Stack gap="sm">
      <CreatableSelect
        label="Company"
        placeholder="Search or create a company (optional)"
        options={companies.map((c) => ({ value: c.id, label: c.name }))}
        value={value.companyId}
        onChange={pickCompany}
        onCreate={async (name) => {
          const c = await createCompany.mutateAsync(
            value.primaryPersonId ? { name, contactIds: [value.primaryPersonId], primaryContactId: value.primaryPersonId } : { name },
          );
          return { value: c.id, label: c.name };
        }}
      />

      {/* Participants — the add field sits above equal-sized cards; ★ marks the deal's primary contact. */}
      <div>
        <Group justify="space-between" mb={6}>
          <Text size="sm" fw={500}>Participants</Text>
          <Group gap={4} c="dimmed">
            <IconStar size={12} />
            <Text size="xs">= primary contact</Text>
          </Group>
        </Group>
        <CreatableSelect
          label=""
          placeholder="Add a participant"
          options={participantOptions}
          value={null}
          onChange={addParticipant}
          onCreate={async (name) => {
            const opt = await participantCreate.prompt(name);
            if (opt) addParticipant(opt.value);
            return opt;
          }}
        />
        {participantCreate.modal}
        {allIds.length > 0 && (
          <Group gap="xs" wrap="nowrap" align="stretch" mt={8} style={{ overflowX: 'auto', paddingBottom: 4 }}>
            {allIds.map((id) => {
              const p = personById.get(id);
              const isPrimary = id === value.primaryPersonId;
              return (
                <PersonMiniCard
                  key={id}
                  id={id}
                  name={p?.name ?? '—'}
                  isPrimary={isPrimary}
                  primaryTooltip={isPrimary ? 'Primary contact' : 'Set as primary contact'}
                  onSetPrimary={() => setPrimary(id)}
                  onRemove={fixedIds.has(id) ? undefined : () => removeParticipant(id)}
                  style={{ flex: '0 0 185px', minWidth: 185 }}
                >
                  <Text size="xs" c="dimmed" lineClamp={1}>{originLabel(id)}</Text>
                  {p?.email && (
                    <Group gap={4} wrap="nowrap" mt={4}>
                      <IconMail size={11} color="var(--mantine-color-gray-6)" />
                      <Text size="xs" lineClamp={1}>{p.email}</Text>
                    </Group>
                  )}
                  {p?.phone && (
                    <Group gap={4} wrap="nowrap">
                      <IconPhone size={11} color="var(--mantine-color-gray-6)" />
                      <Text size="xs" lineClamp={1}>{p.phone}</Text>
                    </Group>
                  )}
                </PersonMiniCard>
              );
            })}
          </Group>
        )}
      </div>
    </Stack>
  );
}
