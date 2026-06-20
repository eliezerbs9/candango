import { apiFetch } from './client';

export interface OnboardingState {
  pipelineCreated: boolean;
  teammatesInvited: boolean;
  brandingSet: boolean;
  completed: boolean;
}

export function getOnboarding(token: string) {
  return apiFetch<OnboardingState>('/onboarding', { token });
}

export function setOnboardingCompleted(token: string, completed: boolean) {
  return apiFetch<OnboardingState>('/onboarding', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ completed }),
  });
}
