import { expect } from '@playwright/test';
export async function acknowledgeFeedback(page, message) {
  const modal = page.getByTestId('feedback-modal');
  await expect(modal).toBeVisible();
  if (message) await expect(modal).toContainText(message);
  await modal.getByRole('button', { name: 'Entendido', exact: true }).click();
  await expect(modal).toHaveCount(0);
}
