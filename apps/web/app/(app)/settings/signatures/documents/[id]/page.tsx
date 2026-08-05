'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Anchor, Badge, Button, Center, FileButton, Group, Loader, Paper, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconUpload } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAutosave } from '@/lib/useAutosave';
import { compressImage } from '@/lib/imageCompress';
import { SaveStatus } from '@/components/proposals/SaveStatus';
import { buildDealCtx } from '@/components/proposals/dealCtx';
import { buildPreviewCtx } from '@/components/proposals/previewCtx';
import { ProposalCanvasEditor, toCanvasPages, type FieldOption } from '@/components/proposals/ProposalCanvasEditor';
import { SignatureFieldEditor } from '@/components/deals/SignatureFieldEditor';
import { VariableTextarea } from '@/components/common/VariableTextarea';
import {
  useCustomFields,
  useDeals,
  useFileUrl,
  useFileUrls,
  useOrganization,
  useProposalMeta,
  useProposalPreviewData,
  useSignableDocument,
  useTemplateVariables,
  useUpdateSignableDocument,
  useUploadFile,
  useUsers,
} from '@/lib/api/hooks';
import type { CanvasPage, ProposalTheme } from '@/lib/api/proposals';
import type { DrawnField } from '@/lib/api/signature-templates';
import type { SignableDocMode } from '@/lib/api/signable-documents';

const fail = (e: unknown) => notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const SIGNABLE = /\.pdf$/i;

const FIELD_TAGS: { label: string; tag: string }[] = [
  { label: 'Signature', tag: '<signature-field name="Signature" role="Client" required="true"></signature-field>' },
  { label: 'Initials', tag: '<initials-field name="Initials" role="Client"></initials-field>' },
  { label: 'Date', tag: '<date-field name="Date" role="Client"></date-field>' },
  { label: 'Text', tag: '<text-field name="Text" role="Client"></text-field>' },
];

function collectFixedKeys(pages: CanvasPage[]): string[] {
  const keys: string[] = [];
  for (const p of pages) {
    if (p.background) keys.push(p.background); // imported PDF page images
    for (const el of p.elements) {
      if (el.props.source !== 'fixed' || !Array.isArray(el.props.files)) continue;
      for (const f of el.props.files as { key?: unknown }[]) if (f && typeof f.key === 'string') keys.push(f.key);
    }
  }
  return keys;
}

/** Rasterize each PDF page to a PNG blob (via pdf.js) so it can back a builder page. */
async function pdfToPageImages(file: File): Promise<Blob[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const blobs: Blob[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // 2x for a crisp background
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) blobs.push(blob);
  }
  return blobs;
}

export default function DocumentTemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading } = useSignableDocument(id);
  const update = useUpdateSignableDocument();
  const { data: users = [] } = useUsers();
  const userOptions = useMemo(() => users.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: u.name || u.email })), [users]);
  const upload = useUploadFile();
  const [importing, setImporting] = useState(false);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<SignableDocMode>('builder');
  const [parties, setParties] = useState<'one' | 'both'>('one');
  const [party2Source, setParty2Source] = useState<'owner' | 'user'>('owner');
  const [party2UserId, setParty2UserId] = useState<string | null>(null);
  const [initialsRule, setInitialsRule] = useState<'none' | 'every_page' | 'specified_pages' | 'last_page'>('none');
  const [initialsPagesText, setInitialsPagesText] = useState('');
  const [initialsParty, setInitialsParty] = useState<'client' | 'sender' | 'both'>('client');
  const [bodyHtml, setBodyHtml] = useState('');
  const [pages, setPages] = useState<CanvasPage[]>([]);
  const [theme, setTheme] = useState<ProposalTheme | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [fields, setFields] = useState<DrawnField[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!doc || hydrated) return;
    setName(doc.name);
    // The document editor is always the visual builder now — a PDF is imported as page backgrounds.
    setMode('builder');
    setParties(doc.parties ?? 'one');
    setParty2Source(doc.party2Source ?? 'owner');
    setParty2UserId(doc.party2UserId ?? null);
    setInitialsRule(doc.initialsRule ?? 'none');
    setInitialsPagesText((doc.initialsPages ?? []).join(', '));
    setInitialsParty(doc.initialsParty ?? 'client');
    setBodyHtml(doc.bodyHtml ?? '');
    const p = toCanvasPages(doc.layout);
    setPages(p.length ? p : [{ id: uid(), elements: [] }]);
    setTheme({ primaryColor: '#e8590c', accentColor: '#1a1a1a', fontHeading: 'Inter', fontBody: 'Inter', coverStyle: 'solid', orientation: 'portrait', ...doc.theme });
    setFileKey(doc.fileKey);
    setFields((doc.fields as DrawnField[]) ?? []);
    setHydrated(true);
  }, [doc, hydrated]);

  // Import a PDF: rasterize each page and set it as a builder page's background (elements go on top).
  const importPdf = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const blobs = await pdfToPageImages(file);
      if (!blobs.length) throw new Error('That PDF had no pages.');
      const keys = await Promise.all(blobs.map((b, i) => upload.mutateAsync({ entity: 'signature', file: new File([b], `page-${i + 1}.png`, { type: 'image/png' }) })));
      setPages(keys.map((key) => ({ id: uid(), elements: [], background: key })));
      notifications.show({ message: `Imported ${keys.length} page${keys.length === 1 ? '' : 's'} from the PDF`, color: 'green' });
    } catch (e) {
      fail(e);
    } finally {
      setImporting(false);
    }
  };

  const status = useAutosave(
    {
      name: name.trim(),
      mode: 'builder',
      parties,
      party2Source: parties === 'both' ? party2Source : 'owner',
      party2UserId: parties === 'both' && party2Source === 'user' ? party2UserId : null,
      initialsRule,
      initialsPages:
        initialsRule === 'specified_pages'
          ? initialsPagesText
              .split(/[,\s]+/)
              .map((s) => parseInt(s, 10))
              .filter((n) => Number.isInteger(n) && n >= 1)
          : [],
      initialsParty: parties === 'both' ? initialsParty : 'client',
      bodyHtml,
      layout: pages,
      theme,
      fileKey,
      fields,
    },
    async (v) => {
      try {
        await update.mutateAsync({ id, body: v as never });
      } catch (e) {
        fail(e);
        throw e;
      }
    },
    hydrated && !!theme,
  );

  if (isLoading || !doc || !theme) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Anchor component={Link} href="/settings/signatures" c="dimmed" size="sm">
        <Group gap={4} wrap="nowrap">
          <IconArrowLeft size={14} /> Signatures
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-end" wrap="wrap">
        <TextInput label="Document name" value={name} onChange={(e) => setName(e.currentTarget.value)} style={{ flex: '1 1 240px' }} />
        <SaveStatus status={status} />
      </Group>

      <Paper withBorder radius="md" p="md">
        <Group align="flex-end" gap="lg" wrap="wrap">
          <div>
            <Text size="xs" fw={500} mb={4}>
              Start from a PDF
            </Text>
            <FileButton onChange={importPdf} accept="application/pdf">
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={14} />} loading={importing}>
                  Import PDF
                </Button>
              )}
            </FileButton>
          </div>
          <div>
            <Text size="xs" fw={500} mb={4}>
              Signed by
            </Text>
            <Select
              data={[
                { value: 'none', label: 'Customer only' },
                { value: 'owner', label: 'Customer + Deal Owner' },
                { value: 'user', label: 'Customer + Specific Team Member' },
              ]}
              value={parties === 'one' ? 'none' : party2Source}
              onChange={(v) => {
                if (v === 'none') {
                  setParties('one');
                  // Dropping the second signer removes its fields — they'd have no one to sign them.
                  setPages(pages.map((pg) => ({ ...pg, elements: pg.elements.filter((el) => !(el.type === 'field' && (el.props as { party?: string })?.party === 'sender')) })));
                } else {
                  setParties('both');
                  setParty2Source(v as 'owner' | 'user');
                }
              }}
              allowDeselect={false}
              w={250}
              comboboxProps={{ withinPortal: true }}
            />
          </div>
          {parties === 'both' && party2Source === 'user' && (
            <div>
              <Text size="xs" fw={500} mb={4}>
                Team member
              </Text>
              <Select placeholder="Pick a user" data={userOptions} value={party2UserId} onChange={setParty2UserId} searchable nothingFoundMessage="No users" w={220} comboboxProps={{ withinPortal: true }} />
            </div>
          )}
          {mode === 'html' && (
            <>
              <div>
                <Text size="xs" fw={500} mb={4}>
                  Initials
                </Text>
                <Select
                  data={[
                    { value: 'none', label: 'No initials' },
                    { value: 'every_page', label: 'Every page' },
                    { value: 'last_page', label: 'Last page' },
                    { value: 'specified_pages', label: 'Specific pages' },
                  ]}
                  value={initialsRule}
                  onChange={(v) => setInitialsRule((v as typeof initialsRule) ?? 'none')}
                  allowDeselect={false}
                  w={180}
                  comboboxProps={{ withinPortal: true }}
                />
              </div>
              {initialsRule === 'specified_pages' && (
                <div>
                  <Text size="xs" fw={500} mb={4}>
                    Pages
                  </Text>
                  <TextInput placeholder="1, 2, 3" value={initialsPagesText} onChange={(e) => setInitialsPagesText(e.currentTarget.value)} w={140} />
                </div>
              )}
              {parties === 'both' && initialsRule !== 'none' && (
                <div>
                  <Text size="xs" fw={500} mb={4}>
                    Who initials
                  </Text>
                  <Select
                    data={[
                      { value: 'client', label: 'Client only' },
                      { value: 'sender', label: 'Second party only' },
                      { value: 'both', label: 'Both parties' },
                    ]}
                    value={initialsParty}
                    onChange={(v) => setInitialsParty((v as typeof initialsParty) ?? 'client')}
                    allowDeselect={false}
                    w={180}
                    comboboxProps={{ withinPortal: true }}
                  />
                </div>
              )}
            </>
          )}
        </Group>
        {mode === 'builder' && (
          <Text size="xs" c="dimmed" mt="sm">
            Drag <strong>Customer fields</strong> onto the page
            {parties === 'both' ? (
              <>
                {' '}
                — a second signer is set, so place <strong>Sender fields</strong> for your side too.
              </>
            ) : (
              '. Choose a second signer to also place Sender fields.'
            )}
          </Text>
        )}
      </Paper>

      {mode === 'builder' ? (
        <BuilderMode pages={pages} onPages={setPages} theme={theme} onTheme={setTheme} senderFields={parties === 'both'} />
      ) : mode === 'upload' ? (
        <UploadMode fileKey={fileKey} onFileKey={setFileKey} fields={fields} onFields={setFields} />
      ) : (
        <HtmlMode bodyHtml={bodyHtml} onBodyHtml={setBodyHtml} />
      )}
    </Stack>
  );
}

// ── Visual builder (reuses the Proposal canvas editor + signature fields) ────────
function BuilderMode({
  pages,
  onPages,
  theme,
  onTheme,
  senderFields,
}: {
  pages: CanvasPage[];
  onPages: (p: CanvasPage[]) => void;
  theme: ProposalTheme;
  onTheme: (t: ProposalTheme) => void;
  senderFields: boolean;
}) {
  const { data: meta } = useProposalMeta();
  const { data: variables = [] } = useTemplateVariables();
  const { data: dealFields = [] } = useCustomFields('deal');
  const { data: org } = useOrganization();
  const { data: deals = [] } = useDeals();
  const upload = useUploadFile();

  const [previewDealId, setPreviewDealId] = useState<string | null>(null);
  const { data: dealPreview } = useProposalPreviewData(previewDealId);

  const fixedKeys = useMemo(() => collectFixedKeys(pages), [pages]);
  const fileUrlByKey = useFileUrls(fixedKeys);
  const ctx = useMemo(
    () => buildPreviewCtx(Object.fromEntries(variables.map((v) => [v.key, v.example])), fileUrlByKey, org?.logoUrl),
    [variables, fileUrlByKey, org?.logoUrl],
  );
  const previewCtx = useMemo(
    () => (dealPreview ? { ...buildDealCtx(dealPreview), fileUrl: (k: string) => dealPreview.fixedFilesByKey?.[k] ?? fileUrlByKey[k] } : undefined),
    [dealPreview, fileUrlByKey],
  );
  const onUploadFile = async (file: File) => {
    const f = file.type.startsWith('image/') ? await compressImage(file) : file;
    return { key: await upload.mutateAsync({ entity: 'signature', file: f }), name: file.name };
  };
  const imageFields: FieldOption[] = useMemo(() => dealFields.filter((f) => f.type === 'image').map((f) => ({ value: f.key, label: f.label })), [dealFields]);
  const documentFields: FieldOption[] = useMemo(() => dealFields.filter((f) => f.type === 'document').map((f) => ({ value: f.key, label: f.label })), [dealFields]);
  // Signature docs render against the signature context — offer Receiver / Sender / Company / Deal / Workspace
  // variables (and drop the signing-link vars, which belong in the invite email, not the document body).
  const sigVars = useMemo(
    () => variables.filter((v) => !v.hidden && (!v.scopes || v.scopes.includes('signature')) && !v.key.startsWith('signature.')),
    [variables],
  );

  return (
    <ProposalCanvasEditor
      pages={pages}
      onPagesChange={onPages}
      theme={theme}
      onThemeChange={onTheme}
      variables={sigVars}
      fonts={meta?.fonts ?? []}
      ctx={ctx}
      imageFields={imageFields}
      documentFields={documentFields}
      onUploadFile={onUploadFile}
      previewDeals={deals.map((d) => ({ value: d.id, label: d.title }))}
      previewDealId={previewDealId}
      onPreviewDealChange={setPreviewDealId}
      previewCtx={previewCtx}
      signatureFields
      senderFields={senderFields}
      resolveFileUrl={(k) => fileUrlByKey[k]}
    />
  );
}

// ── Upload a PDF + place fields visually ─────────────────────────────────────────
function UploadMode({
  fileKey,
  onFileKey,
  fields,
  onFields,
}: {
  fileKey: string | null;
  onFileKey: (k: string | null) => void;
  fields: DrawnField[];
  onFields: (f: DrawnField[]) => void;
}) {
  const upload = useUploadFile();
  const { data: preview } = useFileUrl(fileKey);
  const [busy, setBusy] = useState(false);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!SIGNABLE.test(file.name)) {
      notifications.show({ message: 'Only PDF documents are supported.', color: 'red' });
      return;
    }
    setBusy(true);
    try {
      const key = await upload.mutateAsync({ entity: 'signature', file });
      onFileKey(key);
      onFields([]);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <Group>
        <FileButton onChange={onUpload} accept="application/pdf">
          {(props) => (
            <Button {...props} variant="light" leftSection={<IconUpload size={14} />} loading={busy}>
              {fileKey ? 'Replace PDF' : 'Upload PDF'}
            </Button>
          )}
        </FileButton>
        {fields.length > 0 && (
          <Badge variant="light" color="candango">
            {fields.length} field{fields.length === 1 ? '' : 's'}
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed">
        Upload the document, then drop signature / initials / date / text fields onto exact spots. If you place none, a standard Acceptance &amp; Signature page is appended automatically when the document is sent.
      </Text>
      {fileKey && (
        <Paper withBorder radius="md" p="sm">
          {preview?.url ? (
            <SignatureFieldEditor fileUrl={preview.url} value={fields} onChange={onFields} />
          ) : (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          )}
        </Paper>
      )}
    </Stack>
  );
}

// ── Raw HTML ─────────────────────────────────────────────────────────────────────
function HtmlMode({ bodyHtml, onBodyHtml }: { bodyHtml: string; onBodyHtml: (v: string) => void }) {
  const { data: variables = [] } = useTemplateVariables();
  const dealVars = useMemo(() => variables.filter((v) => !v.hidden && (!v.scopes || v.scopes.includes('deal'))), [variables]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insert = (snippet: string) => {
    const el = bodyRef.current;
    if (!el) {
      onBodyHtml(bodyHtml + snippet);
      return;
    }
    const start = el.selectionStart ?? bodyHtml.length;
    const end = el.selectionEnd ?? bodyHtml.length;
    onBodyHtml(bodyHtml.slice(0, start) + snippet + bodyHtml.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <Stack gap={4}>
      <Group justify="flex-end" gap={4}>
        {FIELD_TAGS.map((f) => (
          <Badge key={f.label} variant="light" color="candango" style={{ cursor: 'pointer', textTransform: 'none' }} onClick={() => insert(f.tag)}>
            + {f.label}
          </Badge>
        ))}
      </Group>
      <VariableTextarea
        inputRef={bodyRef}
        placeholder={'<h2>Service Agreement</h2>\n<p>This agreement is between {{company.name}} and ...</p>'}
        autosize
        minRows={12}
        maxRows={30}
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
        value={bodyHtml}
        onChange={onBodyHtml}
        variables={dealVars}
      />
      <Text size="xs" c="dimmed">
        Write HTML with <code>{'{{variables}}'}</code>. Insert signature fields with the buttons above; if you add none, an Acceptance &amp; Signature block is appended automatically.
      </Text>
    </Stack>
  );
}
