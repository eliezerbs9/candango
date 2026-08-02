import { AppShellLayout } from '@/components/shell/AppShellLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { WorkspaceSetupGate } from '@/components/onboarding/WorkspaceSetupGate';

/**
 * Protected app group: guard first, then the mandatory workspace setup, then the responsive shell.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <WorkspaceSetupGate>
        <AppShellLayout>{children}</AppShellLayout>
      </WorkspaceSetupGate>
    </AuthGuard>
  );
}
