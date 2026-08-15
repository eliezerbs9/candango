'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  MultiSelect,
  Paper,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useAllStages,
  useCustomFields,
  useOrganization,
  usePipelines,
  useQuickbooksStatus,
  useSignableDocuments,
  useUpdateOrganization,
} from '@/lib/api/hooks';
import type { WinRequirements } from '@/lib/api/organization';
import { DealCardSettings } from '@/components/settings/DealCardSettings';

export default function DealsSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: org, isLoading } = useOrganization();
  const { data: stages = [] } = useAllStages();
  const { data: pipelines = [] } = usePipelines();
  const { data: signableDocs = [] } = useSignableDocuments();
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: qb } = useQuickbooksStatus();
  const update = useUpdateOrganization();

  // Required deal fields that gate winning — shown so the admin sees the complete win config.
  const requiredFields = useMemo(() => {
    const stageName = (id: string | null) =>
      stages.find((s) => s.id === id)?.name ?? 'a stage';
    return dealFields
      .filter((f) => f.required || f.requiredForWon || f.requiredFromStageId)
      .map((f) => ({
        id: f.id,
        label: f.label,
        when: f.required || f.requiredForWon ? 'Always' : `From “${stageName(f.requiredFromStageId)}”`,
      }));
  }, [dealFields, stages]);

  const [enabled, setEnabled] = useState(false);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [requireAcceptedProposal, setRequireAcceptedProposal] = useState(false);
  const [requireSignedDocument, setRequireSignedDocument] = useState(false);
  const [signedTemplateIds, setSignedTemplateIds] = useState<string[]>([]);
  const [requireInvoice, setRequireInvoice] = useState(false);

  useEffect(() => {
    const wr = org?.winRequirements ?? {};
    setEnabled(!!wr.enabled);
    setStageIds(wr.stageIds ?? []);
    setRequireAcceptedProposal(!!wr.requireAcceptedProposal);
    setRequireSignedDocument(!!wr.requireSignedDocument);
    setSignedTemplateIds(wr.signedTemplateIds ?? []);
    setRequireInvoice(!!wr.requireInvoice);
  }, [org]);

  // Stages grouped by pipeline for the picker.
  const stageData = useMemo(() => {
    const pipeName = new Map(pipelines.map((p) => [p.id, p.name]));
    const byPipe = new Map<string, { value: string; label: string }[]>();
    for (const s of [...stages].sort((a, b) => a.position - b.position)) {
      const arr = byPipe.get(s.pipelineId) ?? [];
      arr.push({ value: s.id, label: s.name });
      byPipe.set(s.pipelineId, arr);
    }
    return [...byPipe.entries()].map(([pid, items]) => ({ group: pipeName.get(pid) ?? 'Pipeline', items }));
  }, [stages, pipelines]);

  // Reusable signable-document templates (deal-scoped drafts excluded).
  const templateData = useMemo(
    () => signableDocs.filter((d) => d.dealId === null).map((d) => ({ value: d.id, label: d.name })),
    [signableDocs],
  );

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const save = () => {
    const winRequirements: WinRequirements = {
      enabled,
      stageIds,
      requireAcceptedProposal,
      requireSignedDocument,
      signedTemplateIds: requireSignedDocument ? signedTemplateIds : [],
      requireInvoice,
    };
    update.mutate(
      { winRequirements },
      { onSuccess: () => notifications.show({ message: 'Win requirements saved', color: 'green' }), onError: fail },
    );
  };

  if (isLoading || !org) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Grid gutter="xl">
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack>
      <div>
        <Text fw={600}>Win requirements</Text>
        <Text c="dimmed" size="sm">
          Rules a deal must meet before it can be marked <strong>won</strong>. When a rule isn&apos;t met, the
          &quot;Mark won&quot; button is disabled and shows a checklist of what&apos;s missing. Applies to the whole
          workspace.
        </Text>
      </div>

      <Switch
        checked={enabled}
        onChange={(e) => setEnabled(e.currentTarget.checked)}
        disabled={!isAdmin}
        label="Require rules before a deal can be won"
        description={enabled ? undefined : 'Off — deals can be marked won at any time (default).'}
      />

      {enabled && (
        <Paper withBorder radius="md" p="md">
          <Stack gap="lg">
            <MultiSelect
              label="Allowed stages"
              description="The deal must be in one of these stages. Leave empty to allow any stage."
              placeholder={stageIds.length ? undefined : 'Any stage'}
              data={stageData}
              value={stageIds}
              onChange={setStageIds}
              disabled={!isAdmin}
              searchable
              clearable
            />

            <Divider />

            <Switch
              checked={requireAcceptedProposal}
              onChange={(e) => setRequireAcceptedProposal(e.currentTarget.checked)}
              disabled={!isAdmin}
              label="Require an accepted proposal"
              description="The deal must have at least one proposal the client has accepted."
            />

            <Divider />

            <Switch
              checked={requireSignedDocument}
              onChange={(e) => setRequireSignedDocument(e.currentTarget.checked)}
              disabled={!isAdmin}
              label="Require a signed document"
              description="The deal must have at least one completed e-signature."
            />
            {requireSignedDocument && (
              <MultiSelect
                label="From these templates (optional)"
                description="Only count documents generated from these templates. Leave empty to accept any signed document."
                placeholder={signedTemplateIds.length ? undefined : 'Any signed document'}
                data={templateData}
                value={signedTemplateIds}
                onChange={setSignedTemplateIds}
                disabled={!isAdmin}
                searchable
                clearable
                nothingFoundMessage="No document templates yet"
                ml="md"
              />
            )}

            {/* Invoice rule is QuickBooks-only — invoices are a QBO concept. */}
            {qb?.connected && (
              <>
                <Divider />
                <Switch
                  checked={requireInvoice}
                  onChange={(e) => setRequireInvoice(e.currentTarget.checked)}
                  disabled={!isAdmin}
                  label="Require invoice(s)"
                  description="The deal must have at least one QuickBooks invoice. Create one by converting estimates on the deal's Estimates tab, or set up an automation to convert them for you."
                />
              </>
            )}
          </Stack>
        </Paper>
      )}

      <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />}>
        <Text size="sm">
          Required custom fields (set per field on the <strong>Fields</strong> page) always gate winning a deal — they
          show in the checklist regardless of the rules above.
        </Text>
        {requiredFields.length > 0 ? (
          <Stack gap={4} mt="xs">
            {requiredFields.map((f) => (
              <Group key={f.id} gap="xs" wrap="nowrap">
                <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                  {f.when}
                </Badge>
                <Text size="sm">{f.label}</Text>
              </Group>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed" mt={4}>
            No deal fields are currently required to win.
          </Text>
        )}
      </Alert>

      {isAdmin ? (
        <Group>
          <Button onClick={save} loading={update.isPending}>
            Save changes
          </Button>
        </Group>
      ) : (
        <Text size="xs" c="dimmed">
          Only admins can change win requirements.
        </Text>
      )}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        {isAdmin && <DealCardSettings />}
      </Grid.Col>
    </Grid>
  );
}
