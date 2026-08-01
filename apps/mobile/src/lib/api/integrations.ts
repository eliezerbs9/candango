/**
 * Integration connection status (read-only on mobile). Mirrors the status
 * shapes in apps/web/lib/api/integrations.ts. Connecting/disconnecting runs the
 * OAuth flow on the web (Settings → Integrations); mobile only reflects status.
 * (QuickBooks status lives in ./quickbooks.ts via useQuickbooksStatus.)
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

export interface ConnectionInfo {
  status: string;
  updatedAt: string;
}

export interface GoogleStatus {
  connected: boolean;
  calendar: ConnectionInfo | null;
  mailbox: ConnectionInfo | null;
}

export function useGoogleStatus() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['google-status'],
    queryFn: () => apiFetch<GoogleStatus>('/integrations/google', { token: token! }),
    enabled: !!token,
    staleTime: 60_000,
  });
}
