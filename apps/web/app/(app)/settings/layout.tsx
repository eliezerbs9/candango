import { PageHeader } from '@/components/primitives/PageHeader';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsNav />
      {children}
    </>
  );
}
