/**
 * Workspace (organization) info. Mirrors apps/web/lib/api/organization.ts
 * (GET/PATCH /organization) and the web Settings → General page.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  onboardingState: Record<string, unknown>;
  createdAt: string;
}

export function useOrganization() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['organization'],
    queryFn: () => apiFetch<Organization>('/organization', { token: token! }),
    enabled: !!token,
  });
}

export function useUpdateOrganization() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; logoUrl?: string }) =>
      apiFetch<Organization>('/organization', {
        method: 'PATCH',
        token: token!,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}
