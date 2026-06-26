'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getMessages, type ApiMessage } from '@/lib/api/messages';
import { useAuthStore } from '@/lib/auth/store';
import { useGoogleStatus } from '@/lib/api/hooks';

const POLL_MS = 60_000;

/**
 * Polls the inbox while Gmail is connected and raises a toast for each newly-arrived inbound email.
 * Clicking a toast opens the related deal's conversation when the email is linked to a deal,
 * otherwise it opens the mailbox. Mount once, high in the authenticated shell.
 */
export function useEmailNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const { data: google } = useGoogleStatus();
  const connected = !!google?.mailbox;

  const { data } = useQuery({
    queryKey: ['email-poll'],
    queryFn: () => getMessages(token!, { mine: true, folder: 'inbox', limit: 10 }).then((r) => r.data),
    enabled: !!token && connected,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  // Track which inbound message ids we've already announced. The first successful poll only seeds
  // this set (so we never toast the backlog) — toasts fire only for ids seen on later polls.
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  // Reset when the connection drops so reconnecting re-seeds instead of dumping the backlog.
  useEffect(() => {
    if (!connected) {
      seen.current = new Set();
      seeded.current = false;
    }
  }, [connected]);

  useEffect(() => {
    if (!data) return;
    const inbound = data.filter((m) => m.direction === 'in');

    if (!seeded.current) {
      inbound.forEach((m) => seen.current.add(m.id));
      seeded.current = true;
      return;
    }

    const fresh = inbound.filter((m) => !seen.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => seen.current.add(m.id));

    // Keep the inbox / unread counts in sync with what the poller just discovered.
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
    queryClient.invalidateQueries({ queryKey: ['folder-counts'] });

    const open = (m: ApiMessage) => router.push(m.dealId ? `/deals/${m.dealId}` : '/emails');

    if (fresh.length === 1) {
      const m = fresh[0];
      notifications.show({
        title: 'New email',
        message: `${m.subject || '(no subject)'} — from ${m.fromAddress}`,
        color: 'teal',
        onClick: () => open(m),
        style: { cursor: 'pointer' },
      });
    } else {
      notifications.show({
        title: `${fresh.length} new emails`,
        message: 'Click to open your mailbox.',
        color: 'teal',
        onClick: () => router.push('/emails'),
        style: { cursor: 'pointer' },
      });
    }
  }, [data, queryClient, router]);
}
