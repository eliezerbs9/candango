'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconSparkles, IconTrash } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import {
  useCreateProposalTemplate,
  useDeleteProposalTemplate,
  useProposalMeta,
  useOrganization,
  useProposalTemplates,
  useSeedProposalTemplates,
  useTemplateVariables,
} from '@/lib/api/hooks';
import type { ProposalTemplate, ProposalTheme } from '@/lib/api/proposals';
import { PAGE_PRESETS } from '@/components/proposals/ProposalCanvasEditor';
import { ProposalMiniPreview } from '@/components/proposals/ProposalMiniPreview';
import { buildPreviewCtx } from '@/components/proposals/previewCtx';

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function ProposalTemplatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const router = useRouter();
  const { data: templates = [], isLoading } = useProposalTemplates();
  const { data: meta } = useProposalMeta();
  const { data: variables = [] } = useTemplateVariables();
  const { data: org } = useOrganization();
  const thumbCtx = useMemo(
    () => buildPreviewCtx(Object.fromEntries(variables.map((v) => [v.key, v.example])), {}, org?.logoUrl),
    [variables, org?.logoUrl],
  );
  const create = useCreateProposalTemplate();
  const del = useDeleteProposalTemplate();
  const seed = useSeedProposalTemplates();

  const [opened, ctl] = useDisclosure(false);
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [layoutKey, setLayoutKey] = useState('blank');

  const submit = () => {
    if (!name.trim()) return;
    // Orientation + starting layout are chosen once, at creation, and can't change afterwards.
    const preset = PAGE_PRESETS.find((p) => p.key === layoutKey) ?? PAGE_PRESETS[0];
    const firstPage = { id: uid(), elements: preset.build() };
    create.mutate(
      { name: name.trim(), theme: { ...(meta?.defaultTheme as ProposalTheme), orientation }, layout: [firstPage] },
      {
        onSuccess: (t) => {
          ctl.close();
          setName('');
          setLayoutKey('blank');
          setOrientation('portrait');
          router.push(`/settings/proposals/${t.id}`);
        },
        onError: fail,
      },
    );
  };

  const remove = (t: ProposalTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    del.mutate(t.id, {
      onSuccess: () => notifications.show({ message: 'Template deleted', color: 'green' }),
      onError: fail,
    });
  };

  if (!isAdmin) {
    return (
      <Text c="dimmed" size="sm">
        Only admins can manage proposal templates.
      </Text>
    );
  }
  if (isLoading) {
    return (
      <Center mih="30vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={600}>Proposal templates</Text>
          <Text size="sm" c="dimmed">
            Design reusable proposal layouts. Build a proposal from a template inside a deal&apos;s Proposals tab.
          </Text>
        </div>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconSparkles size={16} />}
            loading={seed.isPending}
            onClick={() =>
              seed.mutate(undefined, {
                onSuccess: () => notifications.show({ message: 'Starter templates added', color: 'green' }),
                onError: fail,
              })
            }
          >
            Add starter templates
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={ctl.open}>
            New template
          </Button>
        </Group>
      </Group>

      {templates.length === 0 ? (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm" align="flex-start">
            <Text size="sm" c="dimmed">
              No proposal templates yet. Add the starter templates to get going.
            </Text>
            <Button
              leftSection={<IconSparkles size={16} />}
              loading={seed.isPending}
              onClick={() => seed.mutate(undefined, { onError: fail })}
            >
              Add starter templates
            </Button>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {templates.map((t) => (
            <Card key={t.id} withBorder radius="md" padding="md">
              <Group justify="space-between" wrap="nowrap" mb="xs">
                <Group gap={6} wrap="wrap" align="center" style={{ minWidth: 0 }}>
                  <Text fw={600} lineClamp={1}>
                    {t.name}
                  </Text>
                  {t.system && (
                    <Badge size="xs" variant="light" color="blue" style={{ textTransform: 'none' }}>
                      Starter
                    </Badge>
                  )}
                </Group>
                <Menu position="bottom-end" withinPortal shadow="sm">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="Actions">
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconPencil size={14} />}
                      component={Link}
                      href={`/settings/proposals/${t.id}`}
                    >
                      Edit
                    </Menu.Item>
                    {t.system ? (
                      <Menu.Item leftSection={<IconTrash size={14} />} disabled>
                        Starter (can’t delete)
                      </Menu.Item>
                    ) : (
                      <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => remove(t)}>
                        Delete
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </Group>
              {/* First-page preview (example / John Doe data) */}
              <Link href={`/settings/proposals/${t.id}`} style={{ textDecoration: 'none' }}>
                <ProposalMiniPreview layout={t.layout} theme={t.theme} ctx={thumbCtx} height={170} />
              </Link>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={opened} onClose={ctl.close} title="New proposal template" centered>
        <Stack>
          <TextInput
            label="Template name"
            placeholder="e.g. Kitchen remodel proposal"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            data-autofocus
          />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Orientation
            </Text>
            <SegmentedControl
              fullWidth
              data={[
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
              value={orientation}
              onChange={(v) => setOrientation(v as 'portrait' | 'landscape')}
            />
            <Text size="xs" c="dimmed" mt={4}>
              Chosen once — it can’t change after the template is created.
            </Text>
          </div>
          <Select
            label="Starting layout"
            data={PAGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
            value={layoutKey}
            onChange={(v) => setLayoutKey(v ?? 'blank')}
            allowDeselect={false}
          />
          <Button onClick={submit} loading={create.isPending}>
            Create &amp; edit
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
