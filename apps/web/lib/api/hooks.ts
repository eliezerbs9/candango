'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '@/lib/auth/store';
import { getAllStages, getPipelines, getStages } from './pipelines';
import { getDeals, updateDeal, type DealFilters } from './deals';
import { changePassword, getMe, updateProfile, type Profile } from './profile';
import type { ApiDeal } from './types';

function useToken() {
  return useAuthStore((s) => s.token);
}

export function usePipelines() {
  const token = useToken();
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => getPipelines(token!),
    enabled: !!token,
  });
}

export function useStages(pipelineId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['stages', pipelineId],
    queryFn: () => getStages(token!, pipelineId),
    enabled: !!token && !!pipelineId,
  });
}

export function useAllStages() {
  const token = useToken();
  return useQuery({
    queryKey: ['stages', 'all'],
    queryFn: () => getAllStages(token!),
    enabled: !!token,
  });
}

export function useDeals(filters: DealFilters = {}) {
  const token = useToken();
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => getDeals(token!, filters),
    enabled: !!token,
  });
}

/** Move a deal to another stage, with optimistic update of the pipeline's board. */
export function useMoveDeal(pipelineId: string) {
  const token = useToken();
  const qc = useQueryClient();
  const key = ['deals', { pipelineId }];

  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      updateDeal(token!, id, { stageId }),
    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ApiDeal[]>(key);
      qc.setQueryData<ApiDeal[]>(key, (old) =>
        old?.map((d) => (d.id === id ? { ...d, stageId } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      notifications.show({ message: 'Could not move deal', color: 'red' });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

// --- Profile ---

export function useProfile() {
  const token = useToken();
  return useQuery({ queryKey: ['me'], queryFn: () => getMe(token!), enabled: !!token });
}

export function useUpdateProfile() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<Profile, 'name' | 'phone' | 'avatarUrl'>>) =>
      updateProfile(token!, body),
    onSuccess: (data) => qc.setQueryData(['me'], data),
  });
}

export function useChangePassword() {
  const token = useToken();
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      changePassword(token!, body),
  });
}
