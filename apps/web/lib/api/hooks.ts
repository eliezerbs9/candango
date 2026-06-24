'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '@/lib/auth/store';
import {
  createStage,
  deleteStage,
  getAllStages,
  getPipelines,
  getStages,
  updateStage,
} from './pipelines';
import {
  createDeal,
  getDeal,
  getDeals,
  getStageHistory,
  loseDeal,
  updateDeal,
  winDeal,
  type DealFilters,
} from './deals';
import { createNote, deleteNote, getNotes } from './notes';
import { getFolderCounts, getMessage, getMessageBody, getMessages, type MessageFolder } from './messages';
import { changePassword, getMe, updateProfile, type Profile } from './profile';
import {
  createCompany,
  createPerson,
  deleteCompany,
  deletePerson,
  getCompanies,
  getPersons,
  updateCompany,
  updatePerson,
  type CompanyBody,
  type PersonBody,
} from './contacts';
import {
  completeActivity,
  createActivity,
  getActivities,
  updateActivity,
  type ActivityBody,
  type ActivityFilters,
} from './activities';
import { getByRep, getPipelineReport, getWonLost } from './reports';
import {
  createRole,
  deactivateUser,
  deleteRole,
  getRoles,
  getScopeCatalog,
  getUsers,
  inviteUser,
  updateRole,
  updateUser,
  type RoleBody,
} from './members';
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
import { disconnectGoogle, getGoogleConnectUrl, getGoogleStatus } from './integrations';
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

// --- Stage (pipeline column) mutations ---

export function useCreateStage(pipelineId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; position?: number; probability?: number }) =>
      createStage(token!, pipelineId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stages'] }),
  });
}

export function useUpdateStage() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; position?: number; probability?: number }) =>
      updateStage(token!, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stages'] }),
  });
}

export function useDeleteStage() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStage(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stages'] }),
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

export function useDeal(id: string) {
  const token = useToken();
  return useQuery({ queryKey: ['deal', id], queryFn: () => getDeal(token!, id), enabled: !!token && !!id });
}

export function useStageHistory(dealId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['stage-history', dealId],
    queryFn: () => getStageHistory(token!, dealId),
    enabled: !!token && !!dealId,
  });
}

export function useNotes(dealId?: string, personId?: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['notes', { dealId, personId }],
    queryFn: () => getNotes(token!, { dealId, personId }),
    enabled: !!token && (!!dealId || !!personId),
  });
}

export function useCreateNote() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; dealId?: string; personId?: string }) => createNote(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useDeleteNote() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useDealMessages(dealId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['messages', { dealId }],
    queryFn: () => getMessages(token!, { dealId }).then((r) => r.data),
    enabled: !!token && !!dealId,
  });
}

export function useInbox(folder: MessageFolder) {
  const token = useToken();
  return useInfiniteQuery({
    queryKey: ['inbox', folder],
    queryFn: ({ pageParam }) =>
      getMessages(token!, { mine: true, folder, limit: 25, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!token,
  });
}

export function useFolderCounts() {
  const token = useToken();
  return useQuery({ queryKey: ['folder-counts'], queryFn: () => getFolderCounts(token!), enabled: !!token });
}

export function useMessage(id: string) {
  const token = useToken();
  return useQuery({
    queryKey: ['message', id],
    queryFn: () => getMessage(token!, id),
    enabled: !!token && !!id,
  });
}

export function useMessageBody(id: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ['message-body', id],
    queryFn: () => getMessageBody(token!, id!),
    enabled: !!token && !!id,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal'] });
    },
  });
}

export function useUpdateDeal() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof updateDeal>[2]) =>
      updateDeal(token!, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal'] });
      qc.invalidateQueries({ queryKey: ['stage-history'] });
    },
  });
}

export function useLoseDeal() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => loseDeal(token!, id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['deal'] });
    },
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
    mutationFn: (body: PersonBody) => createPerson(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUpdatePerson() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<PersonBody>) =>
      updatePerson(token!, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useDeletePerson() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePerson(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useCreateCompany() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CompanyBody) => createCompany(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useUpdateCompany() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CompanyBody>) =>
      updateCompany(token!, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useDeleteCompany() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

// --- Activities ---

export function useActivities(filters: ActivityFilters = {}) {
  const token = useToken();
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: () => getActivities(token!, filters),
    enabled: !!token,
  });
}

export function useCreateActivity() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ActivityBody) => createActivity(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useUpdateActivity() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<ActivityBody> & { done?: boolean }) =>
      updateActivity(token!, id, body),
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

export function useScopeCatalog() {
  const token = useToken();
  return useQuery({
    queryKey: ['scope-catalog'],
    queryFn: () => getScopeCatalog(token!),
    enabled: !!token,
    staleTime: Infinity,
  });
}

export function useCreateRole() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RoleBody) => createRole(token!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<RoleBody>) => updateRole(token!, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(token!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
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

// --- Integrations (Google) ---

export function useGoogleStatus() {
  const token = useToken();
  return useQuery({
    queryKey: ['integrations', 'google'],
    queryFn: () => getGoogleStatus(token!),
    enabled: !!token,
  });
}

export function useConnectGoogle() {
  const token = useToken();
  return useMutation({ mutationFn: () => getGoogleConnectUrl(token!) });
}

export function useDisconnectGoogle() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectGoogle(token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'google'] }),
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
