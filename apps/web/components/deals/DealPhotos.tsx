'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Image,
  Loader,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCamera, IconDots, IconExternalLink, IconPlus, IconSearch } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import {
  useCompanyCamProjectSearch,
  useCompanyCamStatus,
  useCreateCompanyCamProject,
  useDealCompanyCamLink,
  useDealCompanyCamPhotos,
  useLinkCompanyCamProject,
  useUnlinkCompanyCamProject,
} from '@/lib/api/hooks';

const fail = (e: unknown, fallback: string) =>
  notifications.show({ message: e instanceof ApiError ? e.message : fallback, color: 'red' });

/** Pick an existing CompanyCam project, or create one from the deal. */
function LinkProject({ dealId, dealTitle }: { dealId: string; dealTitle: string }) {
  const [opened, ctl] = useDisclosure(false);
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 300);
  const search = useCompanyCamProjectSearch(debounced, opened);
  const link = useLinkCompanyCamProject(dealId);
  const create = useCreateCompanyCamProject(dealId);

  const projects = search.data ?? [];

  return (
    <>
      <Group>
        <Button leftSection={<IconSearch size={16} />} variant="default" onClick={ctl.open}>
          Link a project
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          loading={create.isPending}
          onClick={() =>
            create
              .mutateAsync()
              .then(() => notifications.show({ message: 'CompanyCam project created', color: 'green' }))
              .catch((e) => fail(e, 'Could not create the project'))
          }
        >
          Create from this deal
        </Button>
      </Group>

      <Modal opened={opened} onClose={ctl.close} title="Link a CompanyCam project" centered>
        <Stack>
          <TextInput
            placeholder="Search projects by name"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            autoFocus
          />
          {/* Nudge toward an existing project before another duplicate gets created. */}
          {!q && (
            <Text size="sm" c="dimmed">
              Search for “{dealTitle}” to check whether the job already exists in CompanyCam.
            </Text>
          )}
          {search.isFetching && (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          )}
          {!search.isFetching && debounced && projects.length === 0 && (
            <Text size="sm" c="dimmed">
              No project matched — you can create one from this deal instead.
            </Text>
          )}
          <Stack gap="xs">
            {projects.map((p) => (
              <Card
                key={p.id}
                withBorder
                padding="sm"
                radius="md"
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  link
                    .mutateAsync({ projectId: p.id, projectName: p.name })
                    .then(() => {
                      ctl.close();
                      notifications.show({ message: `Linked to ${p.name}`, color: 'green' });
                    })
                    .catch((e) => fail(e, 'Could not link the project'))
                }
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text fw={500}>{p.name}</Text>
                    {p.address && (
                      <Text size="xs" c="dimmed">
                        {p.address}
                      </Text>
                    )}
                  </div>
                  {p.photoCount != null && (
                    <Badge variant="light" color="gray">
                      {p.photoCount} photos
                    </Badge>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}

/**
 * The deal's CompanyCam photos. Images are served straight from CompanyCam — nothing is copied into
 * our storage, so there's no duplicate cost and no bulk-export rate limiting.
 */
export function DealPhotos({ dealId, dealTitle }: { dealId: string; dealTitle: string }) {
  const { data: status, isLoading: statusLoading } = useCompanyCamStatus();
  const { data: linkData, isLoading: linkLoading } = useDealCompanyCamLink(dealId);
  const linked = linkData?.link ?? null;
  const photos = useDealCompanyCamPhotos(dealId, !!linked);
  const unlink = useUnlinkCompanyCamProject(dealId);

  if (statusLoading || linkLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (!status?.connected) {
    return (
      <Alert variant="light" color="blue" icon={<IconCamera size={16} />} title="CompanyCam isn’t connected">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">Connect the workspace to see this job’s photos next to the deal.</Text>
          <Anchor component={Link} href="/settings/integrations" size="sm">
            Go to Integrations
          </Anchor>
        </Stack>
      </Alert>
    );
  }

  if (!linked) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Stack align="flex-start">
          <Text fw={600}>No CompanyCam project yet</Text>
          <Text size="sm" c="dimmed">
            Link the project that documents this job, or create it from the deal — the name and job-site address are
            carried over.
          </Text>
          <LinkProject dealId={dealId} dealTitle={dealTitle} />
        </Stack>
      </Card>
    );
  }

  const list = photos.data?.photos ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <IconCamera size={18} />
          <Text fw={600}>{linked.projectName ?? 'CompanyCam project'}</Text>
          <Badge variant="light" color="gray">
            {list.length} photo{list.length === 1 ? '' : 's'}
          </Badge>
        </Group>
        <Menu position="bottom-end">
          <Menu.Target>
            <Button variant="subtle" px="xs" leftSection={<IconDots size={16} />}>
              Actions
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              onClick={() =>
                unlink.mutateAsync().catch((e) => fail(e, 'Could not unlink the project'))
              }
            >
              Unlink project
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {photos.isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {!photos.isLoading && list.length === 0 && (
        <Text size="sm" c="dimmed">
          This project has no photos yet.
        </Text>
      )}

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
        {list.map((p) => (
          <Tooltip key={p.id} label={[p.creator, p.capturedAt ? new Date(p.capturedAt).toLocaleString() : null].filter(Boolean).join(' · ')} disabled={!p.creator && !p.capturedAt}>
            <Anchor href={p.url} target="_blank" rel="noopener noreferrer">
              <Image src={p.thumbnailUrl} alt="" radius="sm" h={140} fit="cover" />
            </Anchor>
          </Tooltip>
        ))}
      </SimpleGrid>

      <Group gap={4}>
        <IconExternalLink size={14} />
        <Text size="xs" c="dimmed">
          Photos live in CompanyCam — opening one takes you there.
        </Text>
      </Group>
    </Stack>
  );
}
