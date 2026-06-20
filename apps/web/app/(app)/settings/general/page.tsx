'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Center,
  FileButton,
  Group,
  Image,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { useOrganization, useUpdateOrganization } from '@/lib/api/hooks';
import { fileToContainedDataUrl } from '@/lib/image';

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const { data: org, isLoading } = useOrganization();
  const update = useUpdateOrganization();

  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setLogo(org.logoUrl);
    }
  }, [org]);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const pickLogo = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToContainedDataUrl(file);
      setLogo(dataUrl);
      update.mutate(
        { logoUrl: dataUrl },
        { onSuccess: () => notifications.show({ message: 'Logo updated', color: 'green' }), onError: fail },
      );
    } catch (e) {
      fail(e);
    }
  };

  const save = () =>
    update.mutate(
      { name },
      { onSuccess: () => notifications.show({ message: 'Workspace updated', color: 'green' }), onError: fail },
    );

  if (isLoading || !org) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack maw={560}>
      <Text c="dimmed" size="sm">
        Your <strong>workspace</strong> (organization) — name and logo. Distinct from CRM{' '}
        <em>companies</em> you sell to.
      </Text>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between">
          <Group>
            {logo ? (
              <Image src={logo} h={48} w="auto" maw={140} fit="contain" alt="Workspace logo" />
            ) : (
              <Avatar radius="md" size="lg" color="candango">
                {org.name.slice(0, 1).toUpperCase()}
              </Avatar>
            )}
            <div>
              <Text fw={500}>Workspace logo</Text>
              <Text size="xs" c="dimmed">
                PNG, JPG, SVG or WebP
              </Text>
            </div>
          </Group>
          {isAdmin ? (
            <FileButton onChange={pickLogo} accept="image/png,image/jpeg,image/svg+xml,image/webp">
              {(props) => (
                <Button {...props} variant="default" leftSection={<IconUpload size={16} />} loading={update.isPending}>
                  Upload
                </Button>
              )}
            </FileButton>
          ) : null}
        </Group>
      </Paper>

      <TextInput
        label="Workspace name"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        disabled={!isAdmin}
      />

      <Group gap="xl">
        <div>
          <Text size="xs" c="dimmed">
            Plan
          </Text>
          <Badge variant="light" color="yellow" mt={4}>
            {org.plan}
          </Badge>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Workspace ID
          </Text>
          <Text size="sm" ff="monospace" mt={4}>
            {org.id}
          </Text>
        </div>
      </Group>

      {isAdmin ? (
        <Group>
          <Button onClick={save} loading={update.isPending}>
            Save changes
          </Button>
        </Group>
      ) : (
        <Text size="xs" c="dimmed">
          Only admins can change workspace settings.
        </Text>
      )}
    </Stack>
  );
}
