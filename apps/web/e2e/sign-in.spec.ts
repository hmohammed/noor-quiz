import { expect, test } from '@playwright/test';
import { signInWithEmulator } from './helpers/sign-in';

// Real path: browser -> Auth emulator Google popup -> ID token -> Vite proxy /v1/me ->
// functions emulator -> Hono verifies the token and returns our own user.
test('sign in with Google, see my name from /v1/me, then sign out', async ({ page }) => {
  const displayName = 'Amina E2E';
  // A fresh email each run, so the API creates a new user from this display name.
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/');
  const signInButton = page.getByRole('button', { name: 'Sign in with Google' });

  const res = await signInWithEmulator(page, { displayName, email });
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
