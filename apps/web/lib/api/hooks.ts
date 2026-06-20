'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '@/lib/auth/store';
import { getAllStages, getPipelines, getStages } from './pipelines';
import { createDeal, getDeals, loseDeal, updateDeal, winDeal, type DealFilters } from './deals';
import { changePassword, getMe, updateProfile, type Profile } from './profile';
import { createCompany, createPerson, getCompanies, getPersons } from './contacts';
import { completeActivity, createActivity, getActivities } from './activities';
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

// --- Deal mutations ---

export function useCreateDeal() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      value?: number;
      currency?: string;
      pipelineId: string;
      stageId: string;
    }) => createDeal(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useWinDeal() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => winDeal(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useLoseDeal() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => loseDeal(token!, id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

// --- Contacts ---

export function usePersons() {
  const token = useToken();
  return useQuery({ queryKey: ['persons'], queryFn: () => getPersons(token!), enabled: !!token });
}

export function useCompanies() {
  const token = useToken();
  return useQuery({ queryKey: ['companies'], queryFn: () => getCompanies(token!), enabled: !!token });
}

export function useCreatePerson() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email?: string; phone?: string; companyId?: string }) =>
      createPerson(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useCreateCompany() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; domain?: string }) => createCompany(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

// --- Activities ---

export function useActivities() {
  const token = useToken();
  return useQuery({ queryKey: ['activities'], queryFn: () => getActivities(token!), enabled: !!token });
}

export function useCreateActivity() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: 'call' | 'meeting' | 'task' | 'email'; subject: string; dueAt?: string }) =>
      createActivity(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useCompleteActivity() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeActivity(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}
