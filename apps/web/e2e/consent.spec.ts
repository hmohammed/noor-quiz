import { expect, test, type Locator, type Page } from '@playwright/test';
import { acceptConsentOnScreen, signInWithEmulator } from './helpers/sign-in';

const consentHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Before you start' });
const privacyHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Privacy' });

/** Visible, with boxes that do not overlap one another. */
async function expectVisibleApart(locators: Locator[]) {
  const boxes = [];
  for (const locator of locators) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    if (box) boxes.push(box);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(apart, `elements ${i} and ${j} overlap`).toBe(true);
    }
  }
}

test('signed out: /privacy is public and the footer links to it', async ({ page }) => {
  await page.goto('/');
  const footerLink = page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' });
  await expect(footerLink).toBeVisible();

  await page.goto('/privacy');
  await expect(privacyHeading(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('a new user sees the consent screen, can read /privacy, agrees and reaches the app', async ({
  page,
}) => {
  await page.goto('/');
  await signInWithEmulator(page, {
    displayName: 'Consent E2E',
    email: `e2e-consent-${Date.now()}@example.com`,
  });

  // The gate replaces the page; the home content is not rendered.
  await expect(consentHeading(page)).toBeVisible();
  await expect(page.getByTestId('api-status')).toHaveCount(0);
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Profile' })).toHaveCount(0);

  // The gate's privacy link opens the privacy page, not the gate.
  await page.getByRole('main').getByRole('link', { name: 'Read how we handle your data' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(privacyHeading(page)).toBeVisible();
  await expect(consentHeading(page)).toHaveCount(0);

  // Back home, the gate is there again.
  await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click();
  await expect(consentHeading(page)).toBeVisible();

  await acceptConsentOnScreen(page);
  await expect(page.getByTestId('api-status')).toHaveText('API ok');

  await page.reload();
  await expect(page.getByTestId('auth-name')).toHaveText('Consent E2E');
  await expect(page.getByTestId('api-status')).toHaveText('API ok');
  await expect(consentHeading(page)).toHaveCount(0);

  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByLabel('Display name')).toBeVisible();
});

test('RTL: the consent screen and /privacy keep their parts visible and apart', async ({
  page,
}) => {
  await page.goto('/');
  await signInWithEmulator(page, {
    displayName: 'Rtl E2E',
    email: `e2e-rtl-${Date.now()}@example.com`,
  });
  await expect(consentHeading(page)).toBeVisible();
  // T080 adds the real `ar` locale switch; until then force the direction.
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  const main = page.getByRole('main');
  await expectVisibleApart([
    consentHeading(page),
    main.getByRole('link', { name: 'Read how we handle your data' }),
    main.getByRole('button', { name: 'I agree' }),
  ]);

  await main.getByRole('link', { name: 'Read how we handle your data' }).click();
  await expect(privacyHeading(page)).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await expectVisibleApart([privacyHeading(page), page.getByRole('heading', { level: 2 }).first()]);
});
