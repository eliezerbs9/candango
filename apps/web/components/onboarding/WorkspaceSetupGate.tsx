'use client';

import { useState } from 'react';
import { Button, Modal, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/lib/api/client';
import { useOnboarding, useOrganization, useUpdateOrganization } from '@/lib/api/hooks';

// All IANA zones where the browser supports it (Chrome/Safari/FF recent); falls back to the detected one.
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

/**
 * Mandatory first-run setup (FR-11.3): a workspace can't be used until its timezone is set. New
 * signups capture it from the browser automatically; this blocks any workspace still missing one.
 */
export function WorkspaceSetupGate({ children }: { children: React.ReactNode }) {
  const { data: org } = useOrganization();
  const { data: onboarding } = useOnboarding();
  const update = useUpdateOrganization();
  const [tz, setTz] = useState<string | null>(DETECTED || null);

  // Onboarding (which collects the timezone) covers new/incomplete workspaces; this modal is only a
  // fallback for workspaces that already finished onboarding but somehow have no timezone.
  const needsSetup = !!org && !org.timezone && onboarding?.completed === true;

  const save = () => {
    if (!tz) {
      notifications.show({ message: 'Select your workspace timezone', color: 'red' });
      return;
    }
    update.mutate(
      { timezone: tz },
      {
        onSuccess: () => notifications.show({ message: 'Timezone saved', color: 'green' }),
        onError: (e) =>
          notifications.show({ message: e instanceof ApiError ? e.message : 'Could not save', color: 'red' }),
      },
    );
  };

  return (
    <>
      {children}
      <Modal
        opened={needsSetup}
        onClose={() => undefined}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        title="Finish setting up your workspace"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Set your <b>workspace timezone</b> so scheduled automations, due dates and reminders run at the right local
            time. We&apos;ve detected yours — confirm or change it.
          </Text>
          <Select
            label="Workspace timezone"
            required
            searchable
            data={TZ_LIST.length ? TZ_LIST : DETECTED ? [DETECTED] : []}
            value={tz}
            onChange={setTz}
            nothingFoundMessage="No match"
          />
          <Button onClick={save} loading={update.isPending}>
            Save &amp; continue
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
