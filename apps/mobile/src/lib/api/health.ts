/**
 * Health check — the Fase 0 smoke test. Hits GET /v1/health on the API
 * to prove the mobile app can reach the backend end-to-end.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';

export type HealthResponse = {
  status: string;
  service: string;
  ts: string;
};

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
  });
}
