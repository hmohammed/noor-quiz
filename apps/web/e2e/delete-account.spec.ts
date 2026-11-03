import { createHash } from 'node:crypto';
import { expect, test, type Request } from '@playwright/test';
import {
  acceptConsentOnScreen,
  signInAgainWithEmulator,
  signInWithEmulator,
} from './helpers/sign-in';

const isPatchMe = (req: Request) =>
  new URL(req.url()).pathname === '/v1/me' && req.method() === 'PATCH';

interface SeenMe {
  userId: string;
  displayName: string | null;
  required: boolean;
  authorization: string;
}

/** Reads `sub` in memory. The returned hash is what a failure may print, never the subject. */
function subjectHash(authorization: string): string {
  const token = authorization.slice(authorization.indexOf(' ') + 1);
  const payload = token.split('.')[1];
  if (!payload) throw new Error('could not read the token subject');
  let sub: unknown;
  try {
    sub = (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown }).sub;
  } catch {
    throw new Error('could not read the token subject');
  }
  if (typeof sub !== 'string' || sub.length === 0)
    throw new Error('could not read the token subject');
  return createHash('sha256').update(sub).digest('hex');
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('delete my account, then the same Google account starts over', async ({ page }) => {
  const seen: SeenMe[] = [];
  await page.route(/\/v1\/me$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const text = await response.text();
    const body = JSON.parse(text) as {
      userId: string;
      displayName: string | null;
      consent: { required: boolean };
    };
    seen.push({
      userId: body.userId,
      displayName: body.displayName,
      required: body.consent.required,
      authorization: route.request().headers().authorization ?? '',
    });
    await route.fulfill({ response, body: text });
  });

  const email = `e2e-delete-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  await page.goto('/');
  await signInWithEmulator(page, { displayName: 'Delete E2E', email });
  const old = seen.at(-1);
  expect(old, 'GET /v1/me was observed').toBeTruthy();
  expect(old?.required).toBe(true);
  await acceptConsentOnScreen(page);

  await page.getByRole('link', { name: 'Profile' }).click();
  const name = page.getByLabel('Display name');
  await expect(name).toHaveValue('Delete E2E');
  await name.fill('ሀሰን');
  const saved = page.waitForResponse(
    (res) => isPatchMe(res.request()) && 'displayName' in (res.request().postDataJSON() ?? {}),
  );
  await page.getByRole('button', { name: 'Save' }).click();
  expect((await saved).status()).toBe(200);

  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  const deleted = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/v1/me' && res.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Delete my account' }).click();
  expect((await deleted).status()).toBe(204);
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('banner').getByRole('button', { name: 'Sign in with Google' }),
  ).toBeVisible();

  await signInAgainWithEmulator(page, { email });
  const fresh = seen.at(-1);
  expect(fresh, 'GET /v1/me after signing in again was observed').toBeTruthy();
  expect(fresh?.userId).not.toBe(old?.userId);
  expect(fresh?.required).toBe(true);
  expect(fresh?.displayName).toBe('Delete E2E');
  expect(subjectHash(fresh?.authorization ?? '')).toBe(subjectHash(old?.authorization ?? ''));
  await expect(page.getByRole('heading', { level: 1, name: 'Before you start' })).toBeVisible();

  await acceptConsentOnScreen(page);
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByLabel('Display name')).toHaveValue('Delete E2E');
});

test('delete confirmation stays on screen in RTL and cancel sends nothing', async ({ page }) => {
  let deletes = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/v1/me' && req.method() === 'DELETE') deletes += 1;
  });

  const email = `e2e-delete-rtl-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  await page.goto('/');
  await signInWithEmulator(page, { displayName: 'RTL E2E', email });
  await acceptConsentOnScreen(page);
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });

  await page.getByRole('button', { name: 'Delete my account' }).click();
  const confirm = page.getByRole('button', { name: 'Delete my account' });
  const cancel = page.getByRole('button', { name: 'Cancel' });
  await expect(confirm).toBeVisible();
  await expect(cancel).toBeVisible();
  await confirm.scrollIntoViewIfNeeded();

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const confirmBox = await confirm.boundingBox();
  const cancelBox = await cancel.boundingBox();
  expect(confirmBox).toBeTruthy();
  expect(cancelBox).toBeTruthy();
  for (const box of [confirmBox, cancelBox]) {
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
  }
  expect(boxesOverlap(confirmBox!, cancelBox!)).toBe(false);

  await cancel.click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  expect(deletes).toBe(0);
});
