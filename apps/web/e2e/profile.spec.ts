import { expect, test, type Request } from '@playwright/test';
import { signInWithEmulator } from './helpers/sign-in';

const isPatchMe = (req: Request) =>
  new URL(req.url()).pathname === '/v1/me' && req.method() === 'PATCH';

test.describe('profile', () => {
  test.use({ timezoneId: 'Africa/Addis_Ababa' });

  test('first sign-in sends the browser timezone once and the profile shows it', async ({
    page,
  }) => {
    const patches: Request[] = [];
    page.on('request', (req) => {
      if (isPatchMe(req)) patches.push(req);
    });

    await page.goto('/');
    const patched = page.waitForResponse((res) => isPatchMe(res.request()));
    await signInWithEmulator(page, {
      displayName: 'Tz E2E',
      email: `e2e-tz-${Date.now()}@example.com`,
    });
    expect((await patched).status()).toBe(200);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.postDataJSON()).toEqual({ timezone: 'Africa/Addis_Ababa' });

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByLabel('Timezone')).toHaveValue('Africa/Addis_Ababa');
    expect(patches).toHaveLength(1);
  });

  test('change my name to ሀሰን and see it in the header, also after reload', async ({ page }) => {
    await page.goto('/');
    await signInWithEmulator(page, {
      displayName: 'Name E2E',
      email: `e2e-name-${Date.now()}@example.com`,
    });
    await expect(page.getByTestId('auth-name')).toHaveText('Name E2E');

    await page.getByRole('link', { name: 'Profile' }).click();
    const name = page.getByLabel('Display name');
    await expect(name).toHaveValue('Name E2E');
    await name.fill('ሀሰን');

    // The browser-timezone default is also a PATCH; wait for the one carrying the name.
    const saved = page.waitForResponse(
      (res) => isPatchMe(res.request()) && 'displayName' in (res.request().postDataJSON() ?? {}),
    );
    await page.getByRole('button', { name: 'Save' }).click();
    expect((await saved).status()).toBe(200);

    await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
    await expect(page.getByTestId('auth-name')).toHaveText('ሀሰን');

    await page.reload();
    await expect(page.getByTestId('auth-name')).toHaveText('ሀሰን');
    await expect(page.getByLabel('Display name')).toHaveValue('ሀሰን');
  });
});
