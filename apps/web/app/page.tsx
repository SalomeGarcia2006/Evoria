import type { Metadata } from 'next';
import { LandingPage } from '../components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'EVORIA | Sistema de Logística y Planificación de Eventos',
  description:
    'Centraliza la gestión de eventos, inventario, recursos, presupuestos y cronogramas con EVORIA.',
  icons: { icon: '/landing/logo.png' },
};

export default function Home() {
  return <LandingPage />;
}
