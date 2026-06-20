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
