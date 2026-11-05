import { useAuth } from '@/auth';
import { AuthForm } from '@/components/AuthForm';

export default function SignInScreen() {
  const { signIn } = useAuth();
  return <AuthForm mode="sign-in" onSubmit={signIn} />;
}
