import type { Metadata } from 'next';
import { AuthProvider } from '../components/auth/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'EVORIA',
  description: 'Monorepo Next.js + NestJS',
  icons: {
    icon: [{ url: '/images/evoria-favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/images/evoria-favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('evoria-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}})()`,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
