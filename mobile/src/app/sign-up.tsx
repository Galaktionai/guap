import { useAuth } from '@/auth';
import { AuthForm } from '@/components/AuthForm';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  return <AuthForm mode="sign-up" onSubmit={signUp} />;
}
