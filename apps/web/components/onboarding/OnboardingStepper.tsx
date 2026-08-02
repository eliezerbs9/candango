'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  List,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBrandGoogle, IconCheck, IconGift, IconUpload } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { fileToContainedDataUrl, fileToResizedDataUrl } from '@/lib/image';
import {
  useCompleteOnboarding,
  useConnectGoogle,
  useGoogleStatus,
  useInviteUser,
  useOrganization,
  useProfile,
  useRoles,
  useUpdateOrganization,
  useUpdateProfile,
  useUsers,
} from '@/lib/api/hooks';

const STEP_COUNT = 5;
const STEP_KEY = 'candango.onboarding.step'; // survive the Google OAuth round-trip (full page reload)

const TZ_LIST: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
})();
const DETECTED: string = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
})();

const fail = (e: unknown) =>
  notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });

export function OnboardingStepper() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [active, setActive] = useState(0);

  const { data: org } = useOrganization();
  const { data: profile } = useProfile();
  const { data: google } = useGoogleStatus();
  const updateOrg = useUpdateOrganization();
  const updateProfile = useUpdateProfile();
  const complete = useCompleteOnboarding();

  // Restore the step after the Google connect redirect brings us back to a fresh page.
  useEffect(() => {
    const saved = sessionStorage.getItem(STEP_KEY);
    if (saved !== null) {
      setActive(Math.min(Number(saved) || 0, STEP_COUNT - 1));
      sessionStorage.removeItem(STEP_KEY);
    }
  }, []);

  // Workspace
  const [wsName, setWsName] = useState('');
  const [tz, setTz] = useState<string | null>(DETECTED || null);
  const [logo, setLogo] = useState<string | null>(null);
  // Profile
  const [pFirst, setPFirst] = useState('');
  const [pLast, setPLast] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setWsName(org.name);
      setTz(org.timezone ?? DETECTED ?? null);
      setLogo(org.logoUrl);
    }
  }, [org]);
  useEffect(() => {
    if (profile) {
      const parts = (profile.name ?? '').trim().split(/\s+/);
      setPFirst(profile.firstName || parts[0] || '');
      setPLast(profile.lastName || parts.slice(1).join(' ') || '');
      setPPhone(profile.phone ?? '');
      setAvatar(profile.avatarUrl);
    }
  }, [profile]);

  const saveWorkspace = async () => {
    if (!wsName.trim()) return notifications.show({ message: 'Workspace name is required', color: 'red' }), false;
    if (!tz) return notifications.show({ message: 'Pick your timezone', color: 'red' }), false;
    try {
      await updateOrg.mutateAsync({ name: wsName.trim(), timezone: tz, ...(logo ? { logoUrl: logo } : {}) });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };
  const saveProfile = async () => {
    if (!pFirst.trim()) return notifications.show({ message: 'Your first name is required', color: 'red' }), false;
    try {
      await updateProfile.mutateAsync({
        firstName: pFirst.trim(),
        lastName: pLast.trim(),
        phone: pPhone.trim(),
        ...(avatar ? { avatarUrl: avatar } : {}),
      });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const next = async () => {
    if (active === 0 && !(await saveWorkspace())) return;
    if (active === 1 && !(await saveProfile())) return;
    setActive((c) => Math.min(c + 1, STEP_COUNT - 1));
  };
  const back = () => setActive((c) => Math.max(c - 1, 0));
  const finish = () => complete.mutate(true, { onSuccess: () => router.push('/dashboard'), onError: fail });

  const pickLogo = async (file: File | null) => {
    if (!file) return;
    try {
      setLogo(await fileToContainedDataUrl(file));
    } catch {
      notifications.show({ message: 'Could not read image', color: 'red' });
    }
  };
  const pickAvatar = async (file: File | null) => {
    if (!file) return;
    try {
      setAvatar(await fileToResizedDataUrl(file, 256));
    } catch {
      notifications.show({ message: 'Could not read image', color: 'red' });
    }
  };

  const connectGoogle = useConnectGoogle();
  const onConnectGoogle = async () => {
    try {
      const { url } = await connectGoogle.mutateAsync();
      sessionStorage.setItem(STEP_KEY, '3'); // come back to the Connect Google step
      window.location.href = url;
    } catch (e) {
      fail(e);
    }
  };

  const busy = updateOrg.isPending || updateProfile.isPending;

  return (
    <>
      <Stepper active={active} onStepClick={setActive} orientation={isMobile ? 'vertical' : 'horizontal'}>
        {/* 1 — Workspace */}
        <Stepper.Step label="Workspace" description="Name & timezone">
          <Stack mt="md" gap="sm">
            <Text c="dimmed" size="sm">
              Confirm your workspace basics. The timezone keeps due dates, reminders and automations on your local
              clock.
            </Text>
            <TextInput
              label="Workspace name"
              required
              value={wsName}
              onChange={(e) => setWsName(e.currentTarget.value)}
            />
            <Select
              label="Timezone"
              required
              searchable
              data={TZ_LIST.length ? TZ_LIST : tz ? [tz] : []}
              value={tz}
              onChange={setTz}
              nothingFoundMessage="No match"
            />
            <Group>
              {logo ? (
                <Image src={logo} h={40} w="auto" maw={120} fit="contain" alt="Logo" />
              ) : (
                <Avatar radius="md" color="candango">
                  {wsName.slice(0, 1).toUpperCase() || 'C'}
                </Avatar>
              )}
              <FileButton onChange={pickLogo} accept="image/png,image/jpeg,image/svg+xml,image/webp">
                {(props) => (
                  <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                    Upload logo (optional)
                  </Button>
                )}
              </FileButton>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* 2 — Your profile */}
        <Stepper.Step label="Your profile" description="Name & photo">
          <Stack mt="md" gap="sm">
            <Text c="dimmed" size="sm">
              This is how you&apos;ll appear to teammates and on the emails you send.
            </Text>
            <Group>
              <Avatar src={avatar ?? undefined} radius="xl" size="lg" color="candango">
                {pFirst.slice(0, 1).toUpperCase() || profile?.email?.slice(0, 1).toUpperCase() || 'U'}
              </Avatar>
              <FileButton onChange={pickAvatar} accept="image/png,image/jpeg,image/webp">
                {(props) => (
                  <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                    Upload photo (optional)
                  </Button>
                )}
              </FileButton>
            </Group>
            <Group grow>
              <TextInput label="First name" required value={pFirst} onChange={(e) => setPFirst(e.currentTarget.value)} />
              <TextInput label="Last name" value={pLast} onChange={(e) => setPLast(e.currentTarget.value)} />
            </Group>
            <TextInput
              label="Phone"
              description="Optional"
              value={pPhone}
              onChange={(e) => setPPhone(e.currentTarget.value)}
            />
          </Stack>
        </Stepper.Step>

        {/* 3 — Invite team */}
        <Stepper.Step label="Invite team" description="Optional">
          <InviteStep />
        </Stepper.Step>

        {/* 4 — Connect Google */}
        <Stepper.Step label="Connect Google" description={google?.connected ? 'Connected' : 'Recommended'}>
          {google?.connected ? (
            <Card withBorder radius="md" padding="lg" mt="md" bg="var(--mantine-color-teal-0)">
              <Group gap="sm" mb="xs">
                <ThemeIcon variant="light" color="teal" radius="xl" size="lg">
                  <IconCheck size={20} />
                </ThemeIcon>
                <Title order={4}>Nice — Google is connected! 🎉</Title>
              </Group>
              <Text size="sm" c="dimmed">
                Email &amp; calendar features are now fully available — you can send estimates/invoices, use templates
                &amp; automations, and see replies on the timeline. Manage it anytime under Settings → Integrations.
              </Text>
            </Card>
          ) : (
            <Stack mt="md" gap="sm">
              <Group gap="xs">
                <ThemeIcon variant="light" color="candango" radius="xl">
                  <IconBrandGoogle size={18} />
                </ThemeIcon>
                <Title order={5}>Connect Google to unlock the full app</Title>
              </Group>
              <Text size="sm">
                Candango works best connected to Google. <b>Without it, email features are unavailable</b> — you
                won&apos;t be able to:
              </Text>
              <List size="sm" spacing={4}>
                <List.Item>Send estimates &amp; invoices by email, or use email templates &amp; automations</List.Item>
                <List.Item>See client replies logged automatically on the deal timeline</List.Item>
                <List.Item>Sync your calendar &amp; meetings</List.Item>
              </List>
              <Text size="sm" c="dimmed">
                We recommend connecting now to get 100% of the features. You can also do it later under Settings →
                Integrations (per user).
              </Text>
              <Button
                leftSection={<IconBrandGoogle size={16} />}
                onClick={onConnectGoogle}
                loading={connectGoogle.isPending}
                w="fit-content"
              >
                Connect Google
              </Button>
            </Stack>
          )}
        </Stepper.Step>

        {/* 5 — Trial & billing */}
        <Stepper.Step label="You're all set" description="Free trial">
          <Card withBorder radius="md" padding="lg" mt="md" bg="var(--mantine-color-candango-0)">
            <Group gap="sm" mb="xs">
              <ThemeIcon variant="light" color="candango" radius="xl" size="lg">
                <IconGift size={20} />
              </ThemeIcon>
              <div>
                <Badge color="candango" variant="filled">
                  7-day free trial
                </Badge>
              </div>
            </Group>
            <Title order={4} mb={4}>
              Full access, free for 7 days — no card required.
            </Title>
            <Text size="sm" c="dimmed">
              Explore everything with zero commitment. <b>You won&apos;t be asked for payment now</b>, and you won&apos;t
              be charged until your trial ends. Add a card whenever you&apos;re ready under Settings → Billing — cancel
              anytime.
            </Text>
          </Card>
        </Stepper.Step>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={back} disabled={active === 0}>
          Back
        </Button>
        {active < STEP_COUNT - 1 ? (
          <Button onClick={next} loading={busy}>
            {active <= 1 ? 'Save & continue' : 'Next'}
          </Button>
        ) : (
          <Button onClick={finish} loading={complete.isPending} leftSection={<IconCheck size={16} />}>
            Finish &amp; enter Candango
          </Button>
        )}
      </Group>
    </>
  );
}

function InviteStep() {
  const { user } = useAuth();
  const { data: roles = [] } = useRoles();
  const { data: members = [] } = useUsers();
  const invite = useInviteUser();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);

  const submit = () => {
    if (!email.trim()) {
      notifications.show({ message: 'Email is required', color: 'red' });
      return;
    }
    invite.mutate(
      { email: email.trim(), roleId: roleId || undefined },
      {
        onSuccess: () => {
          notifications.show({ message: 'Invitation created', color: 'green' });
          setEmail('');
        },
        onError: (e) => notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
      },
    );
  };

  return (
    <Stack mt="md" gap="sm">
      <Text c="dimmed" size="sm">
        Invite teammates (optional). Each active user is a billable seat ($30/mo) — but not during your trial.
      </Text>
      <Group align="flex-end" wrap="nowrap">
        <TextInput
          label="Email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          label="Role"
          data={roles.map((r) => ({ value: r.id, label: r.name }))}
          value={roleId}
          onChange={setRoleId}
          w={130}
          clearable
        />
        <Button onClick={submit} loading={invite.isPending}>
          Invite
        </Button>
      </Group>
      {members.length > 0 && (
        <Table verticalSpacing="xs" mt="xs" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Member</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm">{m.email}</Text>
                    {m.id === user?.id && (
                      <Badge size="xs" variant="light" color="candango">
                        You
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {m.role}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color={m.status === 'active' ? 'green' : 'yellow'}>
                    {m.status}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
