import { AppShellLayout } from '@/components/shell/AppShellLayout';

/**
 * Protected app group. An auth guard (redirect to /login when no session)
 * will wrap this in UI-1; for now it just renders the responsive shell.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShellLayout>{children}</AppShellLayout>;
}
