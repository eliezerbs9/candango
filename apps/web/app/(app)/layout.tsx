import { AppShellLayout } from '@/components/shell/AppShellLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { WorkspaceSetupGate } from '@/components/onboarding/WorkspaceSetupGate';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';

/**
 * Protected app group: auth → mandatory workspace timezone → mandatory onboarding → the app shell.
 * Both setup gates must pass before any nav is rendered, so onboarding can't be skipped.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <WorkspaceSetupGate>
        <OnboardingGate>
          <AppShellLayout>{children}</AppShellLayout>
        </OnboardingGate>
      </WorkspaceSetupGate>
    </AuthGuard>
  );
}
