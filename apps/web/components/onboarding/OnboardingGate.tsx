'use client';

import { Center, Container } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { useOnboarding } from '@/lib/api/hooks';
import { OnboardingStepper } from './OnboardingStepper';

/**
 * Mandatory onboarding (FR-11.1): until the workspace's setup is marked complete, the app is
 * replaced by a full-screen onboarding flow — no navigation shell, so the user can't skip it and
 * wander into the app. "Finish setup" flips `completed` and releases the gate. While the state is
 * still loading we render the app (no flash for the completed majority); an incomplete workspace
 * is caught as soon as it resolves.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data } = useOnboarding();

  if (data && !data.completed) {
    return (
      <Center mih="100vh" p="md" style={{ alignItems: 'flex-start' }}>
        <Container size="md" w="100%" py="xl">
          <PageHeader title="Welcome to Candango" subtitle="Finish setting up your workspace to continue" />
          <OnboardingStepper />
        </Container>
      </Center>
    );
  }
  return <>{children}</>;
}
