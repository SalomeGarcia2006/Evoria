import { LoginForm } from '../../components/auth/LoginForm';
import { Card } from '../../components/ui/Card';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-beige p-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-3xl font-bold">Iniciar sesión</h1>
        <LoginForm />
      </Card>
    </main>
  );
}
