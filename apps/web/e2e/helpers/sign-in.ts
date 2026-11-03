import { expect, type Page, type Response } from '@playwright/test';

const isGetMe = (res: Response) =>
  new URL(res.url()).pathname === '/v1/me' && res.request().method() === 'GET';

/**
 * Accepts the current consent through the real `POST /v1/me/consent`, with the signed-in
 * user's own token taken from their `GET /v1/me`, then reloads so the app sees it.
 * Resolves with the `GET /v1/me` response after the reload. Never logs the header or
 * token. T013b replaces this with the consent screen.
 */
export async function acceptConsentViaApi(page: Page, meResponse: Response): Promise<Response> {
  const authorization = (await meResponse.request().allHeaders())['authorization'];
  expect(authorization, 'GET /v1/me carried an Authorization header').toBeTruthy();
  const body = (await meResponse.json()) as { consent: { currentVersion: string } };

  const accepted = await page.request.post('/v1/me/consent', {
    headers: { authorization: authorization as string },
    data: { version: body.consent.currentVersion },
  });
  expect(accepted.status()).toBe(200);

  const reloaded = page.waitForResponse(isGetMe);
  await page.reload();
  return reloaded;
}

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

  const meResponse = page.waitForResponse(isGetMe);
  await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();
  return meResponse;
}
