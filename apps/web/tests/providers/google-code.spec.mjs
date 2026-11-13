import { test, expect } from '@playwright/test';

test('mi perfil: código en seis líneas y aviso temporal', async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([
      { name: 'evoria_access_token', value: 'test-only', url: baseURL },
    ]);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    const isConfirmation = path === '/auth/google/change/confirm';
    const data =
      path === '/auth/me'
        ? {
            scope: 'platform',
            user: { id: 'u1', name: 'Camilo', email: 'camilo@example.test' },
            profile: { name: 'Desarrollador' },
            permissions: [],
          }
        : path === '/auth/google/connection'
          ? { linked: true, email: 'camilo@gmail.test', linkedAt: null }
          : null;
    return route.fulfill({
      status: isConfirmation ? 400 : 200,
      headers: {
        'access-control-allow-origin': baseURL,
        'access-control-allow-credentials': 'true',
      },
      contentType: 'application/json',
      body: JSON.stringify(
        isConfirmation ? { message: 'Código incorrecto' } : { data },
      ),
    });
  });

  await page.goto('/mi-perfil');
  await page.clock.install();
  await page.getByRole('button', { name: 'Cambiar cuenta de Google' }).click();
  const inputs = page.getByRole('textbox', { name: /Carácter \d de 6/ });
  await expect(inputs).toHaveCount(6);
  const confirmButton = page.getByRole('button', {
    name: 'Verificar y cambiar cuenta',
  });
  const buttonStaysBelow = async () => {
    const inputBox = await inputs.last().boundingBox();
    const buttonBox = await confirmButton.boundingBox();
    expect(buttonBox.y).toBeGreaterThan(inputBox.y + inputBox.height);
  };
  await buttonStaysBelow();
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(inputs.nth(0)).toHaveCSS(
    'border-bottom-color',
    'rgb(145, 160, 181)',
  );
  await expect(inputs.nth(0)).toHaveCSS('border-bottom-left-radius', '0px');
  await expect(page.getByRole('status')).toContainText('Te enviamos un código');
  await page.clock.fastForward(5100);
  await expect(page.getByRole('status')).toHaveCount(0);

  await inputs.nth(0).fill('a');
  await expect(inputs.nth(1)).toBeFocused();
  await inputs.nth(1).press('Backspace');
  await expect(inputs.nth(0)).toBeFocused();
  await expect(inputs.nth(0)).toHaveValue('');
  await inputs.nth(0).evaluate((input) => {
    const data = new DataTransfer();
    data.setData('text', 'a1b2c3');
    input.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  });
  for (const [index, character] of [...'A1B2C3'].entries()) {
    await expect(inputs.nth(index)).toHaveValue(character);
  }
  await buttonStaysBelow();

  const confirmation = page.waitForRequest((request) =>
    request.url().endsWith('/auth/google/change/confirm'),
  );
  await page
    .getByRole('button', { name: 'Verificar y cambiar cuenta' })
    .click();
  expect((await confirmation).postDataJSON()).toEqual({ code: 'A1B2C3' });
  await expect(
    page.getByText('Código incorrecto', { exact: true }),
  ).toBeVisible();
});
