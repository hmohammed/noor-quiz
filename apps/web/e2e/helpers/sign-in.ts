import type { Page, Response } from '@playwright/test';

/**
 * Signs in a fresh account through the Auth emulator's Google popup, starting from
 * the current page. Resolves with the `GET /v1/me` response that follows.
 */
export async function signInWithEmulator(
  page: Page,
  { displayName, email }: { displayName: string; email: string },
): Promise<Response> {
  // The emulator's sign-in page loads optional styles and scripts from public CDNs before
  // its own inline script, and works without them. Block them so a slow or offline network
  // can't stall the popup.
  await page
    .context()
    .route(/^https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) =>
      route.abort(),
    );

  const popupPromise = page.waitForEvent('popup');
  // The header button; /profile shows a second one when signed out.
  await page.getByRole('banner').getByRole('button', { name: 'Sign in with Google' }).click();
  const popup = await popupPromise;

  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(email);
  await popup.getByLabel('Display name').fill(displayName);

  const meResponse = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/v1/me' && res.request().method() === 'GET',
  );
  await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();
  return meResponse;
}
