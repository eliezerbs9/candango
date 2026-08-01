/** Custom field definitions (deal/person/company). Mirrors apps/web/lib/api/customFields.ts. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { CustomFieldDef, CustomFieldType } from '@/lib/api/types';
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

export function useCreateCustomField() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { entity: string; label: string; type?: CustomFieldType; options?: string[] }) =>
      apiFetch<CustomFieldDef>('/custom-fields', { method: 'POST', token: token!, body: JSON.stringify(body) }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['custom-fields', vars.entity] }),
  });
}

export function useDeleteCustomField() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/custom-fields/${id}`, { method: 'DELETE', token: token! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}
