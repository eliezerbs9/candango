'use client';

import { useState } from 'react';
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
  useProposalTemplates,
  useSeedProposalTemplates,
} from '@/lib/api/hooks';
import type { ProposalTemplate } from '@/lib/api/proposals';

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export default function ProposalTemplatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const router = useRouter();
  const { data: templates = [], isLoading } = useProposalTemplates();
  const { data: meta } = useProposalMeta();
  const create = useCreateProposalTemplate();
  const del = useDeleteProposalTemplate();
  const seed = useSeedProposalTemplates();

  const [opened, ctl] = useDisclosure(false);
  const [name, setName] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), theme: meta?.defaultTheme, layout: [] },
      {
        onSuccess: (t) => {
          ctl.close();
          setName('');
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
              {/* Tiny layout skeleton preview */}
              <Link href={`/settings/proposals/${t.id}`} style={{ textDecoration: 'none' }}>
                <Paper withBorder radius="sm" p="xs" bg="var(--mantine-color-gray-0)">
                  <Stack gap={4}>
                    {(t.layout ?? [])
                      .flatMap((p) => p.rows ?? [])
                      .slice(0, 5)
                      .map((r) => (
                        <Group key={r.id} gap={4} wrap="nowrap">
                          {r.columns.map((c) => (
                            <Paper
                              key={c.id}
                              withBorder
                              radius={2}
                              style={{ flex: c.width, height: 14, background: 'var(--mantine-color-gray-1)' }}
                            />
                          ))}
                        </Group>
                      ))}
                    {(t.layout ?? []).flatMap((p) => p.rows ?? []).length === 0 && (
                      <Text size="xs" c="dimmed">
                        Empty — click to design
                      </Text>
                    )}
                  </Stack>
                </Paper>
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
          <Button onClick={submit} loading={create.isPending}>
            Create &amp; edit
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
