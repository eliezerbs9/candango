import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      footer={{ text: 'No account?', linkLabel: 'Start a free trial', href: '/signup' }}
    >
      <LoginForm />
    </AuthCard>
  );
}
