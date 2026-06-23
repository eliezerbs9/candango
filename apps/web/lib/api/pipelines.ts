import { apiFetch } from './client';
import type { ApiPipeline, ApiStage } from './types';

export function getPipelines(token: string) {
  return apiFetch<ApiPipeline[]>('/pipelines', { token });
}

export function getStages(token: string, pipelineId: string) {
  return apiFetch<ApiStage[]>(`/pipelines/${pipelineId}/stages`, { token });
}

export function getAllStages(token: string) {
  return apiFetch<ApiStage[]>('/stages', { token });
}

export function createStage(
  token: string,
  pipelineId: string,
  body: { name: string; position?: number; probability?: number },
) {
  return apiFetch<ApiStage>(`/pipelines/${pipelineId}/stages`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function updateStage(
  token: string,
  stageId: string,
  body: Partial<{ name: string; position: number; probability: number }>,
) {
  return apiFetch<ApiStage>(`/stages/${stageId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  });
}

export function deleteStage(token: string, stageId: string) {
  return apiFetch<void>(`/stages/${stageId}`, { method: 'DELETE', token });
}
