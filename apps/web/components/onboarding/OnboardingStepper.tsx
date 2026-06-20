'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Badge,
  Button,
  FileButton,
  Group,
  Image,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconUpload } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { fileToContainedDataUrl } from '@/lib/image';
import {
  useCompleteOnboarding,
  useInviteUser,
  useOrganization,
  usePipelines,
  useRoles,
  useUpdateOrganization,
  useUsers,
} from '@/lib/api/hooks';

const STEP_COUNT = 5;

function PipelineStep() {
  const { data: pipelines = [] } = usePipelines();
  const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  return (
    <Stack mt="md" gap="xs">
      <Group gap="xs">
        <IconCheck size={18} color="var(--mantine-color-teal-6)" />
        <Text fw={500}>Your pipeline is ready.</Text>
      </Group>
      {def ? (
        <Text c="dimmed" size="sm">
          Default pipeline: <strong>{def.name}</strong>. Rename or add stages anytime under Pipelines.
        </Text>
      ) : (
        <Text c="dimmed" size="sm">
          No pipeline found.
        </Text>
      )}
    </Stack>
  );
}

function InviteStep() {
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
        onError: (e) =>
          notifications.show({ message: e instanceof ApiError ? e.message : 'Failed', color: 'red' }),
      },
    );
  };

  return (
    <Stack mt="md" gap="sm">
      <Text c="dimmed" size="sm">
        Invite teammates (optional). Each active user is a billable seat ($30/mo).
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
      <Stack gap={4} mt="xs">
        {members.map((m) => (
          <Group key={m.id} gap="xs">
            <Text size="sm">{m.email}</Text>
            <Badge size="xs" variant="light" color={m.status === 'active' ? 'green' : 'yellow'}>
              {m.status}
            </Badge>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}

function LogoStep() {
  const { data: org } = useOrganization();
  const update = useUpdateOrganization();
  const [logo, setLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (org) {
      setLogo(org.logoUrl);
      setLogoError(false);
    }
  }, [org]);

  const pick = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToContainedDataUrl(file);
      setLogo(dataUrl);
      setLogoError(false);
      update.mutate(
        { logoUrl: dataUrl },
        { onSuccess: () => notifications.show({ message: 'Logo uploaded', color: 'green' }) },
      );
    } catch {
      notifications.show({ message: 'Could not read image', color: 'red' });
    }
  };

  return (
    <Stack mt="md" gap="sm">
      <Text c="dimmed" size="sm">
        Upload your workspace logo (optional). Change it later in Settings → General.
      </Text>
      <Group>
        {logo && !logoError ? (
          <Image src={logo} h={40} w="auto" maw={120} fit="contain" alt="Logo" onError={() => setLogoError(true)} />
        ) : (
          <Avatar radius="md" color="candango">
            {org?.name?.slice(0, 1).toUpperCase() ?? 'C'}
          </Avatar>
        )}
        <FileButton onChange={pick} accept="image/png,image/jpeg,image/svg+xml,image/webp">
          {(props) => (
            <Button {...props} variant="default" leftSection={<IconUpload size={16} />} loading={update.isPending}>
              Upload logo
            </Button>
          )}
        </FileButton>
      </Group>
    </Stack>
  );
}

function ComingSoonStep({ title, desc }: { title: string; desc: string }) {
  return (
    <Stack mt="md" gap="xs">
      <Text fw={500}>{title}</Text>
      <Text c="dimmed" size="sm">
        {desc}
      </Text>
    </Stack>
  );
}

export function OnboardingStepper() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [active, setActive] = useState(0);
  const complete = useCompleteOnboarding();

  const next = () => setActive((c) => Math.min(c + 1, STEP_COUNT - 1));
  const back = () => setActive((c) => Math.max(c - 1, 0));
  const finish = () => complete.mutate(true, { onSuccess: () => router.push('/dashboard') });

  return (
    <>
      <Stepper active={active} onStepClick={setActive} orientation={isMobile ? 'vertical' : 'horizontal'}>
        <Stepper.Step label="Pipeline" description="Ready">
          <PipelineStep />
        </Stepper.Step>
        <Stepper.Step label="Invite team" description="Optional">
          <InviteStep />
        </Stepper.Step>
        <Stepper.Step label="Logo" description="Optional">
          <LogoStep />
        </Stepper.Step>
        <Stepper.Step label="Connect Google" description="Optional">
          <ComingSoonStep
            title="Connect Google"
            desc="Sync meetings and email per user. Available soon — you can connect it later under Settings → Integrations."
          />
        </Stepper.Step>
        <Stepper.Step label="Payment" description="Optional">
          <ComingSoonStep
            title="Add payment"
            desc="You're on a 7-day free trial. Add a card later in Settings → Billing — no charge until the trial ends."
          />
        </Stepper.Step>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={back} disabled={active === 0}>
          Back
        </Button>
        {active < STEP_COUNT - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={finish} loading={complete.isPending}>
            Finish setup
          </Button>
        )}
      </Group>
    </>
  );
}
