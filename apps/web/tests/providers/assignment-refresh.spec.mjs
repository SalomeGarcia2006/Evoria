import { test, expect } from '@playwright/test';

for (const initialized of [true, false]) {
  for (const delay of [0, 900]) {
    test(`actualizar conserva el evento y comprueba el presupuesto (${initialized ? 'iniciado' : 'pendiente'}, ${delay} ms)`, async ({
      page,
      baseURL,
    }) => {
      test.setTimeout(60000);
      let eventCalls = 0;
      let budgetCalls = 0;
      let inventoryCalls = 0;
      let serviceCalls = 0;
      let failBudget = false;
      let failPath = '';
      let budgetInitialized = initialized;
      let inventoryName = 'Sillas';
      const event = {
        id: 'e1',
        name: 'Evento de prueba',
        status: 'planificado',
        startAt: '2026-12-05T15:00:00Z',
        endAt: '2026-12-06T02:00:00Z',
      };
      await page
        .context()
        .addCookies([
          { name: 'evoria_access_token', value: 'test', url: baseURL },
        ]);
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname.replace(
          '/api',
          '',
        );
        const headers = {
          'access-control-allow-origin': baseURL,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
        };
        if (failPath === path)
          return route.fulfill({
            status: 503,
            headers,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Fallo de prueba' }),
          });
        let data = [];
        if (path === '/auth/me')
          data = {
            scope: 'tenant',
            user: { id: 'u1', name: 'QA', email: 'qa@example.test' },
            profile: { name: 'QA' },
            tenant: { id: 't1', name: 'Empresa' },
            permissions: [
              'eventos.ver',
              'asignaciones.ver',
              'asignaciones.crear',
              'inventario.ver',
              'presupuestos.ver',
              'servicios_proveedor.ver',
            ],
          };
        else if (path === '/events')
          data = { items: [event], pagination: { totalPages: 1 } };
        else if (path === '/events/e1') {
          if (++eventCalls > 1 && delay)
            await new Promise((r) => setTimeout(r, delay));
          data = event;
        } else if (path === '/events/e1/budget') {
          if (++budgetCalls > 1 && delay)
            await new Promise((r) => setTimeout(r, 100));
          if (failBudget)
            return route.fulfill({
              status: 503,
              headers,
              contentType: 'application/json',
              body: JSON.stringify({
                message: 'Error al consultar presupuesto',
              }),
            });
          data = { initialized: budgetInitialized };
        } else if (path === '/inventory') {
          if (++inventoryCalls > 1 && delay)
            await new Promise((r) => setTimeout(r, 100));
          data = {
            items: [
              {
                id: 'i1',
                name: inventoryName,
                type: 'Mobiliario',
                availableQuantity: 4,
                totalQuantity: 4,
                reservedQuantity: 0,
                status: 'disponible',
                unitCost: 100,
              },
            ],
            pagination: { totalPages: 1 },
          };
        } else if (path === '/events/e1/provider-services') {
          if (++serviceCalls > 1 && delay)
            await new Promise((r) => setTimeout(r, delay));
        }
        await route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ data }),
        });
      });
      await page.goto('/recursos/asignaciones');
      await page
        .getByRole('button', { name: 'Ver asignaciones de Evento de prueba' })
        .click();
      const dialog = page.getByRole('dialog', {
        name: 'Asignaciones · Evento de prueba',
      });
      await expect(dialog.getByText('Reservas de inventario')).toBeVisible();
      if (initialized) {
        await expect(
          dialog.getByRole('button', { name: 'Asignar recurso' }),
        ).toBeVisible();
        await dialog.getByLabel('Recurso de inventario').selectOption('i1');
      } else
        await expect(
          dialog.getByText(
            'Para crear asignaciones, inicia primero el presupuesto del evento.',
          ),
        ).toBeVisible();
      const heading = dialog.getByRole('heading', {
        name: 'Evento de prueba',
        exact: true,
      });
      const initialTop = (await heading.boundingBox()).y;
      await page.evaluate(() => {
        const samples = [];
        window.__refreshFrames = samples;
        window.__recordRefresh = true;
        const sample = () => {
          if (!window.__recordRefresh) return;
          const dialog = document.querySelector(
            'dialog[open]:not([role="alertdialog"])',
          );
          if (dialog) {
            const heading = [...dialog.querySelectorAll('h3')].find(
              (el) => el.textContent === 'Evento de prueba',
            );
            const texts = [...dialog.querySelectorAll('p, h2, h3, h4')]
              .filter((el) => el.getClientRects().length)
              .map((el) => el.textContent.trim());
            samples.push({ y: heading?.getBoundingClientRect().y, texts });
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await dialog.getByRole('button', { name: 'Actualizar evento' }).click();
      if (delay) {
        await expect(
          dialog.getByRole('heading', {
            name: 'Evento de prueba',
            exact: true,
          }),
        ).toBeVisible({ timeout: 300 });
        await expect(dialog.getByText('Reservas de inventario')).toBeVisible();
        await expect(
          dialog.getByRole('heading', {
            name: 'Servicios de proveedores',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          dialog.getByText('Comprobando requisitos del presupuesto…'),
        ).toHaveCount(0);
        expect(
          Math.abs((await heading.boundingBox()).y - initialTop),
        ).toBeLessThan(2);
        if (initialized)
          await expect(
            dialog.getByText(
              'Para crear asignaciones, inicia primero el presupuesto del evento.',
            ),
          ).toHaveCount(0);
      }
      await expect.poll(() => budgetCalls).toBeGreaterThan(1);
      await expect(
        dialog.getByText(
          'Actualizando información del evento y sus asignaciones…',
        ),
      ).toHaveCount(0);
      const confirmation = page.getByTestId('feedback-modal');
      await expect(confirmation.locator('.event-success-modal')).toBeVisible();
      await expect(confirmation).toContainText('se actualizó correctamente');
      const frames = await page.evaluate(() => {
        window.__recordRefresh = false;
        return window.__refreshFrames;
      });
      expect(frames.length).toBeGreaterThan(0);
      expect(
        frames.every(
          (frame) =>
            frame.y !== undefined && Math.abs(frame.y - initialTop) < 2,
        ),
      ).toBeTruthy();
      expect(
        frames.every(
          (frame) =>
            !frame.texts.some((text) =>
              /Comprobando requisitos del presupuesto|Cargando inventario disponible|Actualizando información del evento/.test(
                text,
              ),
            ),
        ),
      ).toBeTruthy();
      await confirmation.getByRole('button', { name: 'Entendido' }).click();
      if (initialized)
        await expect(
          dialog.getByRole('button', { name: 'Asignar recurso' }),
        ).toBeEnabled();
      else
        await expect(
          dialog.getByText(
            'Para crear asignaciones, inicia primero el presupuesto del evento.',
          ),
        ).toBeVisible();
      if (initialized && delay) {
        inventoryName = 'Sillas renovadas';
        await dialog.getByRole('button', { name: 'Actualizar evento' }).click();
        await page.waitForTimeout(350);
        await expect(
          dialog
            .getByLabel('Recurso de inventario')
            .locator('option[value="i1"]'),
        ).toContainText('Sillas ·');
        await expect(
          confirmation.locator('.event-success-modal'),
        ).toBeVisible();
        await confirmation.getByRole('button', { name: 'Entendido' }).click();
        await expect(
          dialog
            .getByLabel('Recurso de inventario')
            .locator('option[value="i1"]'),
        ).toContainText('Sillas renovadas');
        budgetInitialized = false;
        await dialog.getByRole('button', { name: 'Actualizar evento' }).click();
        await page.waitForTimeout(350);
        await expect(dialog.getByLabel('Recurso de inventario')).toBeVisible();
        await expect(
          dialog.getByText(
            'Para crear asignaciones, inicia primero el presupuesto del evento.',
          ),
        ).toHaveCount(0);
        await expect(
          confirmation.locator('.event-success-modal'),
        ).toBeVisible();
        await confirmation.getByRole('button', { name: 'Entendido' }).click();
        await expect(
          dialog.getByText(
            'Para crear asignaciones, inicia primero el presupuesto del evento.',
          ),
        ).toBeVisible();
        budgetInitialized = true;
        await dialog.getByRole('button', { name: 'Actualizar evento' }).click();
        await page.waitForTimeout(350);
        await expect(
          dialog.getByText(
            'Para crear asignaciones, inicia primero el presupuesto del evento.',
          ),
        ).toBeVisible();
        await expect(
          dialog.getByText('Cargando inventario disponible…'),
        ).toHaveCount(0);
        await expect(
          confirmation.locator('.event-success-modal'),
        ).toBeVisible();
        await confirmation.getByRole('button', { name: 'Entendido' }).click();
        await dialog.getByLabel('Recurso de inventario').selectOption('i1');
        failBudget = true;
        await dialog.getByRole('button', { name: 'Actualizar evento' }).click();
        await expect(confirmation.locator('.login-alert-modal')).toBeVisible();
        await expect(confirmation).toContainText(
          'Presupuesto: Error al consultar presupuesto',
        );
        await confirmation.getByRole('button', { name: 'Entendido' }).click();
        await expect(
          dialog.getByText('Error al consultar presupuesto'),
        ).toBeVisible();
        await expect(
          dialog.getByRole('heading', {
            name: 'Evento de prueba',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          dialog.getByText(
            'Para crear asignaciones, inicia primero el presupuesto del evento.',
          ),
        ).toHaveCount(0);
        await expect(
          dialog.getByRole('button', { name: 'Asignar recurso' }),
        ).toBeDisabled();
        failBudget = false;
        await dialog
          .getByRole('button', { name: 'Reintentar presupuesto' })
          .click();
        await expect(
          dialog.getByRole('button', { name: 'Asignar recurso' }),
        ).toBeEnabled();
        for (const [path, name] of [
          ['/events/e1', 'Evento'],
          ['/events/e1/resources', 'Asignaciones'],
          ['/inventory', 'Inventario'],
          ['/events/e1/provider-services', 'Servicios'],
        ]) {
          failPath = path;
          await dialog
            .getByRole('button', { name: 'Actualizar evento' })
            .click();
          await page.waitForTimeout(150);
          await expect(dialog.getByText('Fallo de prueba')).toHaveCount(0);
          await expect(
            confirmation.locator('.login-alert-modal'),
          ).toBeVisible();
          await expect(confirmation).toContainText(`${name}: Fallo de prueba`);
          await confirmation.getByRole('button', { name: 'Entendido' }).click();
          failPath = '';
          await dialog
            .getByRole('button', { name: 'Actualizar evento' })
            .click();
          await expect(
            confirmation.locator('.event-success-modal'),
          ).toBeVisible();
          await confirmation.getByRole('button', { name: 'Entendido' }).click();
        }
      }
    });
  }
}
