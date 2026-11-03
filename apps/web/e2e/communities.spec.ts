import { expect, test } from '@playwright/test';
import { acceptConsentOnScreen, signInWithEmulator } from './helpers/sign-in';

test('a signed-in user creates a community and sees it in the list', async ({ page }) => {
  await page.goto('/');
  await signInWithEmulator(page, {
    displayName: 'Community E2E',
    email: `e2e-community-${Date.now()}@example.com`,
  });
  await acceptConsentOnScreen(page);

  await page.getByRole('link', { name: 'Communities' }).click();
  await page.getByLabel('Community name').fill('Masjid Al Noor');
  await page.getByLabel('Timezone').selectOption('Europe/Stockholm');

  const created = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/v1/communities' && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create community' }).click();
  expect((await created).status()).toBe(201);

  await expect(page.getByRole('listitem').filter({ hasText: 'Masjid Al Noor' })).toBeVisible();
});
