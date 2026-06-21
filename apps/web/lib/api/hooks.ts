'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '@/lib/auth/store';
import { getAllStages, getPipelines, getStages } from './pipelines';
import { createDeal, getDeals, loseDeal, updateDeal, winDeal, type DealFilters } from './deals';
import { changePassword, getMe, updateProfile, type Profile } from './profile';
import { createCompany, createPerson, getCompanies, getPersons } from './contacts';
import { completeActivity, createActivity, getActivities } from './activities';
import { getByRep, getPipelineReport, getWonLost } from './reports';
import { deactivateUser, getRoles, getUsers, inviteUser, updateUser } from './members';
import { getOrganization, updateOrganization } from './organization';
import { getOnboarding, setOnboardingCompleted } from './onboarding';
import { createApiKey, getApiKeys, revokeApiKey } from './apikeys';
import {
  createWebhook,
  deleteWebhook,
  getDeliveries,
  getWebhooks,
  pingWebhook,
  replayDelivery,
  updateWebhook,
} from './webhooks';
import { createCustomField, deleteCustomField, getCustomFields } from './customFields';
import type { CustomFieldType } from './customFields';
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
      companyId?: string;
      primaryPersonId?: string;
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

export function useUpdateDeal() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateDeal>[2]) =>
      updateDeal(token!, id, body),
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

// --- Reports ---

export function usePipelineReport(pipelineId?: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['report', 'pipeline', pipelineId ?? null],
    queryFn: () => getPipelineReport(token!, pipelineId),
    enabled: !!token,
  });
}

export function useByRep() {
  const token = useToken();
  return useQuery({ queryKey: ['report', 'rep'], queryFn: () => getByRep(token!), enabled: !!token });
}

export function useWonLost() {
  const token = useToken();
  return useQuery({ queryKey: ['report', 'wonlost'], queryFn: () => getWonLost(token!), enabled: !!token });
}

// --- Members & Roles ---

export function useUsers() {
  const token = useToken();
  return useQuery({ queryKey: ['users'], queryFn: () => getUsers(token!), enabled: !!token });
}

export function useRoles() {
  const token = useToken();
  return useQuery({ queryKey: ['roles'], queryFn: () => getRoles(token!), enabled: !!token });
}

export function useInviteUser() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; name?: string; roleId?: string }) => inviteUser(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; roleId?: string; status?: string }) =>
      updateUser(token!, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateUser(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// --- Organization (workspace) ---

export function useOrganization() {
  const token = useToken();
  return useQuery({
    queryKey: ['organization'],
    queryFn: () => getOrganization(token!),
    enabled: !!token,
  });
}

export function useUpdateOrganization() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; logoUrl?: string }) => updateOrganization(token!, body),
    onSuccess: (data) => qc.setQueryData(['organization'], data),
  });
}

// --- Onboarding ---

export function useOnboarding() {
  const token = useToken();
  return useQuery({
    queryKey: ['onboarding'],
    queryFn: () => getOnboarding(token!),
    enabled: !!token,
  });
}

export function useCompleteOnboarding() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (completed: boolean) => setOnboardingCompleted(token!, completed),
    onSuccess: (data) => qc.setQueryData(['onboarding'], data),
  });
}

// --- API keys ---

export function useApiKeys(enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => getApiKeys(token!),
    enabled: !!token && enabled,
  });
}

export function useCreateApiKey() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: string[] }) => createApiKey(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeApiKey(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

// --- Webhooks ---

export function useWebhooks(enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => getWebhooks(token!),
    enabled: !!token && enabled,
  });
}

export function useCreateWebhook() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; eventTypes: string[] }) => createWebhook(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useUpdateWebhook() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; isActive?: boolean; eventTypes?: string[] }) =>
      updateWebhook(token!, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWebhook(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useWebhookDeliveries(webhookId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => getDeliveries(token!, webhookId!),
    enabled: !!token && !!webhookId,
  });
}

export function usePingWebhook() {
  const token = useToken();
  return useMutation({ mutationFn: (id: string) => pingWebhook(token!, id) });
}

export function useReplayDelivery() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => replayDelivery(token!, deliveryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-deliveries'] }),
  });
}

// --- Custom fields (admin-defined) ---

export function useCustomFields(entity: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['custom-fields', entity],
    queryFn: () => getCustomFields(token!, entity),
    enabled: !!token && !!entity,
  });
}

export function useCreateCustomField() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { entity: string; label: string; type?: CustomFieldType; options?: string[] }) =>
      createCustomField(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}

export function useDeleteCustomField() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomField(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-fields'] }),
  });
}
