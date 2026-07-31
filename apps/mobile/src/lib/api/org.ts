/** Organization info + members (for assignee pickers). */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

export interface OrgMember {
  id: string;
  name: string | null;
  email: string;
}

export function useOrgMembers() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['org-members'],
    queryFn: () => apiFetch<OrgMember[]>('/organization/members', { token: token! }),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}
