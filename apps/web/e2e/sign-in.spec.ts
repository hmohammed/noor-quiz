import { expect, test } from '@playwright/test';

// Real path: browser -> Auth emulator Google popup -> ID token -> Vite proxy /v1/me ->
// functions emulator -> Hono verifies the token and returns our own user.
test('sign in with Google, see my name from /v1/me, then sign out', async ({ page }) => {
  const displayName = 'Amina E2E';
  // A fresh email each run, so the API creates a new user from this display name.
  const email = `e2e-${Date.now()}@example.com`;

  // The emulator's sign-in page loads optional styles and scripts from public CDNs before
  // its own inline script, and works without them. Block them so a slow or offline network
  // can't stall the popup.
  await page
    .context()
    .route(/^https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) =>
      route.abort(),
    );

  await page.goto('/');
  const signInButton = page.getByRole('button', { name: 'Sign in with Google' });

  const popupPromise = page.waitForEvent('popup');
  await signInButton.click();
  const popup = await popupPromise;

  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(email);
  await popup.getByLabel('Display name').fill(displayName);

  const meResponse = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/v1/me' && res.request().method() === 'GET',
  );
  await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();

  const res = await meResponse;
  expect(res.status()).toBe(200);
  // Check the header's shape only; never print the token.
  expect(/^Bearer \S+$/.test(res.request().headers()['authorization'] ?? '')).toBe(true);
  const body = (await res.json()) as { displayName: string | null };
  expect(body.displayName).toBe(displayName);

  await expect(page.getByTestId('auth-name')).toHaveText(body.displayName ?? '');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(signInButton).toBeVisible();
  await expect(page.getByTestId('auth-name')).toHaveCount(0);
});
