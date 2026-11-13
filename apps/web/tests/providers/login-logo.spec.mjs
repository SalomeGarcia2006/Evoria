import { expect, test } from '@playwright/test';

test('el logo del login conserva el círculo y tamaño en ambos temas', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('evoria-theme', 'light'));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/login');
  const circle = page.locator('.login-brand-logo');
  const logo = circle.getByRole('img', { name: 'Logo de EVORIA' });
  await expect(logo).toBeVisible();
  await logo.evaluate((img) => img.decode());
  await expect(circle).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const lightSize = await logo.boundingBox();
  const circleSize = await circle.boundingBox();
  expect(lightSize.width).toBeLessThanOrEqual(circleSize.width * 0.71);
  expect(lightSize.height).toBeLessThanOrEqual(circleSize.height * 0.71);
  expect(
    Math.abs(
      lightSize.x + lightSize.width / 2 - (circleSize.x + circleSize.width / 2),
    ),
  ).toBeLessThan(1);
  expect(
    Math.abs(
      lightSize.y +
        lightSize.height / 2 -
        (circleSize.y + circleSize.height / 2),
    ),
  ).toBeLessThan(1);
  const imageSource = await logo.getAttribute('src');
  await expect(logo).toHaveCSS('object-fit', 'contain');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await expect(circle).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const darkSize = await logo.boundingBox();
  expect(darkSize.width).toBe(lightSize.width);
  expect(darkSize.height).toBe(lightSize.height);
  expect(await logo.getAttribute('src')).toBe(imageSource);
  await expect(logo).toHaveCSS('object-fit', 'contain');
});
