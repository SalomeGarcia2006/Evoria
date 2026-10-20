import type { Metadata } from 'next';
import { AuthProvider } from '../components/auth/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'EVORIA',
  description: 'Monorepo Next.js + NestJS',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
