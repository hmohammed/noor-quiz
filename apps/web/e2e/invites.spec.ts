import { expect, test } from '@playwright/test';
import { acceptConsentOnScreen, signInWithEmulator } from './helpers/sign-in';

test('user A creates an invite and user B joins that community', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const remoteQr: string[] = [];
  pageA.on('request', (req) => {
    if (/qrserver|chart\.googleapis|goqr|api\.qr/i.test(req.url())) remoteQr.push(req.url());
  });

  try {
    const stamp = Date.now();
    await pageA.goto('/');
    await signInWithEmulator(pageA, {
      displayName: 'Invite Owner',
      email: `e2e-invite-a-${stamp}@example.com`,
    });
    await acceptConsentOnScreen(pageA);

    await pageA.getByRole('link', { name: 'Communities' }).click();
    await pageA.getByLabel('Community name').fill('Masjid Al Noor');
    await pageA.getByLabel('Timezone').selectOption('Europe/Stockholm');
    const createdCommunity = pageA.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/v1/communities' && res.request().method() === 'POST',
    );
    await pageA.getByRole('button', { name: 'Create community' }).click();
    expect((await createdCommunity).status()).toBe(201);
    await expect(pageA.getByRole('listitem').filter({ hasText: 'Masjid Al Noor' })).toBeVisible();

    const createdInvite = pageA.waitForResponse(
      (res) =>
        /\/v1\/t\/[^/]+\/invites$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'POST',
    );
    await pageA.getByRole('button', { name: 'Invite' }).click();
    expect((await createdInvite).status()).toBe(201);

    const dialog = pageA.getByRole('dialog');
    const link = dialog.getByRole('link');
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(new URL(href ?? '').pathname).toMatch(/^\/join\/[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    const qr = await dialog.getByRole('img', { name: 'QR code' }).getAttribute('src');
    expect(qr?.startsWith('data:')).toBe(true);
    expect(remoteQr).toEqual([]);

    await pageB.goto(href ?? '/');
    await expect(pageB.getByText('Masjid Al Noor', { exact: true })).toBeVisible();
    await signInWithEmulator(pageB, {
      displayName: 'Invite Joiner',
      email: `e2e-invite-b-${stamp}@example.com`,
    });
    await acceptConsentOnScreen(pageB);
    await expect(pageB.getByText('Masjid Al Noor', { exact: true })).toBeVisible();

    const accepted = pageB.waitForResponse(
      (res) =>
        /\/v1\/invites\/[^/]+\/accept$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'POST',
    );
    await pageB.getByRole('button', { name: 'Join' }).click();
    expect((await accepted).status()).toBe(201);
    await expect(pageB.getByText('You joined')).toBeVisible();

    await pageB.getByRole('link', { name: 'Communities' }).click();
    await expect(pageB.getByRole('listitem').filter({ hasText: 'Masjid Al Noor' })).toBeVisible();
    expect(remoteQr).toEqual([]);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
