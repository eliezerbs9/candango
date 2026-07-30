/** Custom field definitions (deal/person/company). Mirrors apps/web/lib/api/customFields.ts. */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { CustomFieldDef } from '@/lib/api/types';
import { useAuthStore } from '@/lib/auth/store';

export function useCustomFields(entity: 'deal' | 'person' | 'company') {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['custom-fields', entity],
    queryFn: () => apiFetch<CustomFieldDef[]>(`/custom-fields?entity=${entity}`, { token: token! }),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
}
