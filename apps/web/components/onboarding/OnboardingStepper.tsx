'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Stepper, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

const STEPS = [
  { label: 'Pipeline', description: 'Create your first pipeline', hint: 'A default pipeline is seeded; rename stages later.' },
  { label: 'Invite team', description: 'Add teammates', hint: 'Each active user is a billable seat ($30/mo).' },
  { label: 'Branding', description: 'Logo & color', hint: 'Upload a logo and pick a brand color.' },
  { label: 'Connect Google', description: 'Calendar & email', hint: 'Authorize Google to sync meetings and email.' },
  { label: 'Payment', description: 'Add a card', hint: 'Optional during the trial; needed to continue after 7 days.' },
];

export function OnboardingStepper() {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [active, setActive] = useState(0);

  const next = () => setActive((c) => Math.min(c + 1, STEPS.length));
  const back = () => setActive((c) => Math.max(c - 1, 0));
  const finish = () => router.push('/dashboard');

  return (
    <>
      <Stepper active={active} onStepClick={setActive} orientation={isMobile ? 'vertical' : 'horizontal'}>
        {STEPS.map((s) => (
          <Stepper.Step key={s.label} label={s.label} description={s.description}>
            <Text mt="md" c="dimmed">
              {s.hint}
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              (Step UI placeholder — wired to its feature/API in a later step.)
            </Text>
          </Stepper.Step>
        ))}
        <Stepper.Completed>
          <Text mt="md">You're all set! 🎉</Text>
        </Stepper.Completed>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={back} disabled={active === 0}>
          Back
        </Button>
        {active < STEPS.length ? (
          <Button onClick={next}>{active === STEPS.length - 1 ? 'Finish' : 'Next'}</Button>
        ) : (
          <Button onClick={finish}>Go to dashboard</Button>
        )}
      </Group>
    </>
  );
}
