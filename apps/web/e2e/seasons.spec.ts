import { expect, test, type Locator, type Page } from '@playwright/test';
import { acceptConsentOnScreen, signInWithEmulator } from './helpers/sign-in';

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

async function openSeasons(page: Page, email: string) {
  await page.goto('/');
  await signInWithEmulator(page, { displayName: 'Season E2E', email });
  await acceptConsentOnScreen(page);
  await page.getByRole('link', { name: 'Communities' }).click();
  await page.getByLabel('Community name').fill('Masjid Al Noor');
  await page.getByLabel('Timezone').selectOption('Europe/Stockholm');
  const created = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/v1/communities' && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create community' }).click();
  expect((await created).status()).toBe(201);
  await page.getByRole('link', { name: 'Seasons' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Seasons' })).toBeVisible();
}

async function fillSeason(page: Page, startDate: string) {
  await page.getByLabel('Season name').fill('Ramadan 1448');
  await page.getByLabel('Kind').selectOption({ label: 'Ramadan' });
  await page.getByLabel('Timezone').selectOption('Europe/Stockholm');
  await page.getByLabel('Start date').fill(startDate);
  await page.getByLabel('Length (days)').fill('30');
  await page.getByLabel('Opens at').fill('08:00');
  await page.getByLabel('Closes at').fill('21:00');
}

test('an admin creates a season and sees it listed as upcoming', async ({ page }) => {
  await openSeasons(page, `e2e-season-${Date.now()}@example.com`);
  await fillSeason(page, '2035-01-01');

  const created = page.waitForResponse(
    (res) =>
      /\/v1\/t\/[^/]+\/seasons$/.test(new URL(res.url()).pathname) &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create season' }).click();
  expect((await created).status()).toBe(201);

  const item = page.getByRole('listitem').filter({ hasText: 'Ramadan 1448' });
  await expect(item).toBeVisible();
  await expect(item).toContainText('2035-01-01');
  await expect(item).toContainText('Upcoming');
});

test('a suggestion can be replaced, and the season screen stays readable in RTL', async ({
  page,
}) => {
  await openSeasons(page, `e2e-season-suggest-${Date.now()}@example.com`);

  const suggested = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname.endsWith('/seasons/ramadan-suggestion') &&
      res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Suggest Hijri start' }).click();
  expect((await suggested).status()).toBe(200);
  await expect(page.getByLabel('Start date')).not.toHaveValue('');
  await expect(page.getByRole('listitem')).toHaveCount(0);

  await fillSeason(page, '2035-01-01');
  const created = page.waitForResponse(
    (res) =>
      /\/v1\/t\/[^/]+\/seasons$/.test(new URL(res.url()).pathname) &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create season' }).click();
  expect((await created).status()).toBe(201);

  const item = page.getByRole('listitem').filter({ hasText: 'Ramadan 1448' });
  await expect(item).toContainText('2035-01-01');

  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await expectVisibleApart([
    page.getByRole('heading', { level: 1, name: 'Seasons' }),
    item,
    page.getByLabel('Season name'),
  ]);
});
