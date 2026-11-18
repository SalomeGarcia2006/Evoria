import type { EventClient } from '@evoria/contracts';

/** Fictitious data for isolated tests, never used to fill historical events. */
export function eventClientFixture(
  overrides: Partial<EventClient> = {},
): EventClient {
  return {
    name: 'Cliente de prueba',
    identification: '0012345678',
    phone: '+57 300 123 4567',
    address: 'Calle 10 # 20-30, Bogotá',
    email: 'cliente@example.test',
    ...overrides,
  };
}
