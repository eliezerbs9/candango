import { apiFetch } from './client';

export interface PipelineReport {
  kpis: { openValue: number; weightedValue: number; openDeals: number };
  byStage: {
    stageId: string;
    stageName: string;
    count: number;
    totalValue: number;
    weightedValue: number;
  }[];
}

export interface RepRow {
  name: string;
  openValue: number;
  won: number;
  lost: number;
}

export interface WonLostRow {
  period: string;
  won: number;
  lost: number;
}

export function getPipelineReport(token: string, pipelineId?: string) {
  const qs = pipelineId ? `?pipeline_id=${pipelineId}` : '';
  return apiFetch<PipelineReport>(`/reports/pipeline${qs}`, { token });
}

export function getByRep(token: string) {
  return apiFetch<RepRow[]>('/reports/sales?group_by=rep', { token });
}

export function getWonLost(token: string) {
  return apiFetch<WonLostRow[]>('/reports/won-lost', { token });
}
