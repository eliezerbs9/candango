'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Anchor, Center, Group, Loader, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAutosave } from '@/lib/useAutosave';
import { compressImage } from '@/lib/imageCompress';
import { SaveStatus } from '@/components/proposals/SaveStatus';
import { buildDealCtx } from '@/components/proposals/dealCtx';
import {
  useCustomFields,
  useDeals,
  useEmailTemplates,
  useFileUrls,
  useOrganization,
  useProposalMeta,
  useProposalPreviewData,
  useProposalTemplate,
  useTemplateVariables,
  useUpdateProposalTemplate,
  useUploadFile,
} from '@/lib/api/hooks';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import { ProposalCanvasEditor, toCanvasPages, type FieldOption } from '@/components/proposals/ProposalCanvasEditor';
import { buildPreviewCtx } from '@/components/proposals/previewCtx';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Object keys of every template-owned "fixed" image/document file across the pages. */
function collectFixedKeys(pages: CanvasPage[]): string[] {
  const keys: string[] = [];
  for (const p of pages) {
    for (const el of p.elements) {
      if (el.props.source !== 'fixed' || !Array.isArray(el.props.files)) continue;
      for (const f of el.props.files as { key?: unknown }[]) {
        if (f && typeof f.key === 'string') keys.push(f.key);
      }
    }
  }
  return keys;
}

export default function ProposalTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading } = useProposalTemplate(id);
  const { data: meta } = useProposalMeta();
  const { data: variables = [] } = useTemplateVariables();
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: org } = useOrganization();
  const update = useUpdateProposalTemplate();
  const upload = useUploadFile();

  const [name, setName] = useState('');
  const [theme, setTheme] = useState<ProposalTheme | null>(null);
  const [pages, setPages] = useState<CanvasPage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [previewDealId, setPreviewDealId] = useState<string | null>(null);

  const { data: deals = [] } = useDeals();
  const { data: dealPreview } = useProposalPreviewData(previewDealId);

  // Resolve template-owned uploaded files (image/document "fixed" source) so they render in the editor/preview.
  const fixedKeys = useMemo(() => collectFixedKeys(pages), [pages]);
  const fileUrlByKey = useFileUrls(fixedKeys);
  // The canvas always uses example data; the Preview modal can switch to a real deal.
  const ctx = useMemo(
    () => buildPreviewCtx(Object.fromEntries(variables.map((v) => [v.key, v.example])), fileUrlByKey, org?.logoUrl),
    [variables, fileUrlByKey, org?.logoUrl],
  );
  const previewCtx = useMemo(
    () =>
      dealPreview
        ? { ...buildDealCtx(dealPreview), fileUrl: (k: string) => dealPreview.fixedFilesByKey?.[k] ?? fileUrlByKey[k] }
        : undefined,
    [dealPreview, fileUrlByKey],
  );
  const onUploadFile = async (file: File) => {
    const f = file.type.startsWith('image/') ? await compressImage(file) : file;
    return { key: await upload.mutateAsync({ entity: 'proposal', file: f }), name: file.name };
  };
  const imageFields: FieldOption[] = useMemo(
    () => dealFields.filter((f) => f.type === 'image').map((f) => ({ value: f.key, label: f.label })),
    [dealFields],
  );
  const documentFields: FieldOption[] = useMemo(
    () => dealFields.filter((f) => f.type === 'document').map((f) => ({ value: f.key, label: f.label })),
    [dealFields],
  );

  useEffect(() => {
    if (!template || hydrated) return;
    setName(template.name);
    setTheme({ orientation: 'portrait', ...template.theme });
    const p = toCanvasPages(template.layout);
    setPages(p.length ? p : [{ id: uid(), elements: [] }]);
    setHydrated(true);
  }, [template, hydrated]);

  const status = useAutosave(
    { name: name.trim(), theme, layout: pages },
    async (v) => {
      try {
        await update.mutateAsync({ id, body: v as { name: string; theme: ProposalTheme; layout: CanvasPage[] } });
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    hydrated && !!theme,
  );

  if (isLoading || !template || !theme) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/settings/proposals" c="dimmed" size="sm">
        <Group gap={4} wrap="nowrap">
          <IconArrowLeft size={14} /> Proposal templates
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput label="Template name" value={name} onChange={(e) => setName(e.currentTarget.value)} style={{ flex: '1 1 240px' }} />
        <SaveStatus status={status} />
      </Group>

      <ProposalCanvasEditor
        pages={pages}
        onPagesChange={setPages}
        theme={theme}
        onThemeChange={setTheme}
        variables={variables}
        fonts={meta?.fonts ?? []}
        ctx={ctx}
        imageFields={imageFields}
        documentFields={documentFields}
        onUploadFile={onUploadFile}
        previewDeals={deals.map((d) => ({ value: d.id, label: d.title }))}
        previewDealId={previewDealId}
        onPreviewDealChange={setPreviewDealId}
        previewCtx={previewCtx}
      />
    </Stack>
  );
}
