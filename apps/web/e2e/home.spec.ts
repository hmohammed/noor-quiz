import { expect, test } from '@playwright/test';

// Real path: browser -> Vite proxy /v1 -> functions emulator -> Hono.
test('home page shows that the API is reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('api-status')).toHaveText('API ok');
});
