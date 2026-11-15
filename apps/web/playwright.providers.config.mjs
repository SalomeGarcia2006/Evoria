import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/providers',
  outputDir: './test-results/providers',
  workers: 2,
  fullyParallel: true,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    channel: process.env.E2E_BROWSER_CHANNEL || 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3100',
          localStorage: ['u1', 'requester', 'leader'].flatMap((id) =>
            [
              '/dashboard',
              '/empresas',
              '/eventos',
              '/inventario',
              '/recursos/asignaciones',
              '/proveedores',
              '/presupuestos',
              '/cronograma',
              '/alertas',
              '/reportes',
              '/auditoria',
              '/usuarios',
              '/perfiles',
              '/mi-perfil',
            ].map((path) => ({
              name: `evoria-module-tour:${id}:${path}`,
              value: 'done',
            })),
          ),
        },
      ],
    },
  },
  projects: [
    { name: 'escritorio', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'movil',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node tests/providers/server.mjs',
    url: 'http://localhost:3100',
    timeout: 60000,
    reuseExistingServer: false,
  },
});
