import { Container } from '@mantine/core';
import { PageHeader } from '@/components/primitives/PageHeader';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';

export default function OnboardingPage() {
  return (
    <Container size="md" px={0}>
      <PageHeader title="Welcome to Candango" subtitle="Let's set up your workspace" />
      <OnboardingStepper />
    </Container>
  );
}
