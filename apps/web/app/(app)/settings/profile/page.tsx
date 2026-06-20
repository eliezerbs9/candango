'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Center,
  Divider,
  FileButton,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useChangePassword, useProfile, useUpdateProfile } from '@/lib/api/hooks';
import { fileToResizedDataUrl } from '@/lib/image';

export default function ProfilePage() {
  const { data: me, isLoading } = useProfile();
  const update = useUpdateProfile();
  const changePw = useChangePassword();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');

  useEffect(() => {
    if (me) {
      setName(me.name ?? '');
      setPhone(me.phone ?? '');
      setAvatar(me.avatarUrl ?? null);
    }
  }, [me]);

  const fail = (e: unknown) =>
    notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

  const pickAvatar = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setAvatar(dataUrl);
      update.mutate(
        { avatarUrl: dataUrl },
        { onSuccess: () => notifications.show({ message: 'Photo updated', color: 'green' }), onError: fail },
      );
    } catch (e) {
      fail(e);
    }
  };

  const saveProfile = () =>
    update.mutate(
      { name, phone },
      { onSuccess: () => notifications.show({ message: 'Profile saved', color: 'green' }), onError: fail },
    );

  const savePassword = () => {
    if (nw !== cf) {
      notifications.show({ message: 'New passwords do not match', color: 'red' });
      return;
    }
    changePw.mutate(
      { currentPassword: cur, newPassword: nw },
      {
        onSuccess: () => {
          notifications.show({ message: 'Password changed', color: 'green' });
          setCur('');
          setNw('');
          setCf('');
        },
        onError: fail,
      },
    );
  };

  if (isLoading) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Stack maw={560}>
      <Text c="dimmed" size="sm">
        Manage your personal profile. (Workspace settings are under <strong>General</strong>.)
      </Text>

      <Paper withBorder radius="md" p="md">
        <Group>
          <Avatar src={avatar ?? undefined} size="lg" radius="xl" color="candango">
            {(name || me?.email || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <Text fw={500}>Photo</Text>
            <Text size="xs" c="dimmed" mb={6}>
              PNG, JPG or WebP
            </Text>
            <FileButton onChange={pickAvatar} accept="image/png,image/jpeg,image/webp">
              {(props) => (
                <Button {...props} variant="default" size="xs" loading={update.isPending}>
                  Upload photo
                </Button>
              )}
            </FileButton>
          </div>
        </Group>
      </Paper>

      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <TextInput
        label="Phone"
        placeholder="+1 555-0100"
        value={phone}
        onChange={(e) => setPhone(e.currentTarget.value)}
      />
      <TextInput label="Email" value={me?.email ?? ''} disabled />
      <Group>
        <Button onClick={saveProfile} loading={update.isPending}>
          Save profile
        </Button>
      </Group>

      <Divider my="sm" label="Change password" labelPosition="left" />
      <PasswordInput label="Current password" value={cur} onChange={(e) => setCur(e.currentTarget.value)} />
      <PasswordInput label="New password" value={nw} onChange={(e) => setNw(e.currentTarget.value)} />
      <PasswordInput
        label="Confirm new password"
        value={cf}
        onChange={(e) => setCf(e.currentTarget.value)}
      />
      <Group>
        <Button variant="default" onClick={savePassword} loading={changePw.isPending}>
          Change password
        </Button>
      </Group>
    </Stack>
  );
}
