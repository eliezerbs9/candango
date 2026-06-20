import { AppShellLayout } from '@/components/shell/AppShellLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';

/**
 * Protected app group: guard first, then the responsive shell.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShellLayout>{children}</AppShellLayout>
    </AuthGuard>
  );
}
