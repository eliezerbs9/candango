'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Center, Group, Loader, Modal, Paper, Stack, Text, Textarea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconClock, IconX } from '@tabler/icons-react';
import { ApiError } from '@/lib/api/client';
import { getPublicProposal, respondPublicProposal, type ProposalDecision } from '@/lib/api/public-proposal';
import type { ProposalRenderData } from '@/lib/api/proposals';
import { ProposalRenderer } from '@/components/proposals/ProposalRenderer';
import { buildDealCtx } from '@/components/proposals/dealCtx';

const RESPONDED = ['accepted', 'denied', 'deferred'];

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ProposalRenderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [feedbackOpen, feedbackCtl] = useDisclosure(false);
  const [pendingDecision, setPendingDecision] = useState<ProposalDecision | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicProposal(token)
      .then((d) => active && (setData(d), setStatus(d.status)))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : 'Could not load this proposal.'));
    return () => {
      active = false;
    };
  }, [token]);

  const respond = async (decision: ProposalDecision, note?: string) => {
    setBusy(true);
    try {
      const r = await respondPublicProposal(token, decision, note);
      setStatus(r.status);
      feedbackCtl.close();
      setFeedback('');
      notifications.show({ message: 'Thanks — your response was recorded.', color: 'green' });
    } catch (e) {
      notifications.show({ message: e instanceof ApiError ? e.message : 'Something went wrong', color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  const choose = (decision: ProposalDecision) => {
    if (decision === 'accepted') return respond('accepted');
    setPendingDecision(decision);
    feedbackCtl.open();
  };

  if (error) {
    return (
      <Center mih="100vh" p="md">
        <Text c="dimmed">{error}</Text>
      </Center>
    );
  }
  if (!data) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }

  const responded = RESPONDED.includes(status);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--mantine-color-gray-1)', paddingBottom: responded ? 40 : 96 }}>
      {/* Header */}
      <Group justify="space-between" px="lg" py="sm" wrap="nowrap" style={{ background: '#fff', borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {data.logoUrl && <img src={data.logoUrl} alt="" style={{ height: 28, objectFit: 'contain' }} />}
          <Text fw={600} lineClamp={1}>
            {data.title}
          </Text>
        </Group>
        {responded && (
          <Group gap={6} wrap="nowrap">
            {status === 'accepted' && <IconCheck size={16} color="var(--mantine-color-teal-6)" />}
            {status === 'denied' && <IconX size={16} color="var(--mantine-color-red-6)" />}
            {status === 'deferred' && <IconClock size={16} color="var(--mantine-color-yellow-7)" />}
            <Text size="sm" c="dimmed" style={{ textTransform: 'capitalize' }}>
              {status === 'deferred' ? 'Deciding later' : status}
            </Text>
          </Group>
        )}
      </Group>

      {/* Proposal — rendered at the template's orientation, scaled to the screen */}
      <div style={{ maxWidth: (data.theme?.orientation ?? 'portrait') === 'landscape' ? 1000 : 760, margin: '0 auto', padding: '24px 16px' }}>
        <ProposalRenderer layout={data.content} theme={data.theme} ctx={buildDealCtx(data)} paged />
      </div>

      {/* Sticky response bar */}
      {!responded && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: '1px solid var(--mantine-color-gray-3)', padding: '12px 16px' }}>
          <Group justify="center" gap="sm" wrap="wrap">
            <Button color="teal" leftSection={<IconCheck size={16} />} onClick={() => choose('accepted')} loading={busy}>
              Accept
            </Button>
            <Button variant="default" leftSection={<IconClock size={16} />} onClick={() => choose('deferred')}>
              Decide later
            </Button>
            <Button variant="outline" color="red" leftSection={<IconX size={16} />} onClick={() => choose('denied')}>
              Decline
            </Button>
          </Group>
        </div>
      )}

      <Modal
        opened={feedbackOpen}
        onClose={feedbackCtl.close}
        title={pendingDecision === 'denied' ? 'Decline proposal' : 'Decide later'}
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Please share a short note so we know how to help.
          </Text>
          <Textarea autosize minRows={3} value={feedback} onChange={(e) => setFeedback(e.currentTarget.value)} data-autofocus />
          <Group justify="flex-end">
            <Button variant="default" onClick={feedbackCtl.close}>
              Cancel
            </Button>
            <Button
              color={pendingDecision === 'denied' ? 'red' : 'yellow'}
              disabled={!feedback.trim()}
              loading={busy}
              onClick={() => pendingDecision && respond(pendingDecision, feedback.trim())}
            >
              Submit
            </Button>
          </Group>
        </Stack>
      </Modal>

      {responded && (
        <Center px="md">
          <Paper withBorder radius="md" p="md" maw={520} w="100%">
            <Text size="sm">
              {status === 'accepted'
                ? 'You accepted this proposal — thank you! We’ll be in touch shortly.'
                : status === 'denied'
                  ? 'You declined this proposal. Thanks for letting us know.'
                  : 'You chose to decide later. We’ll follow up with you.'}
            </Text>
            {data.feedback && (
              <Text size="sm" c="dimmed" mt="xs">
                Your note: “{data.feedback}”
              </Text>
            )}
          </Paper>
        </Center>
      )}
    </div>
  );
}
