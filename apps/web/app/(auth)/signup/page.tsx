import { AuthCard } from '@/components/auth/AuthCard';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your workspace"
      subtitle="7-day free trial. No credit card required to start."
      footer={{ text: 'Already have an account?', linkLabel: 'Sign in', href: '/login' }}
    >
      <SignupForm />
    </AuthCard>
  );
}
