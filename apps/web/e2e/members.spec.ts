import { expect, test } from '@playwright/test';
import { acceptConsentOnScreen, signInWithEmulator } from './helpers/sign-in';

test('owner manages members and a member leaves from the communities list', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    const stamp = Date.now();
    await pageA.goto('/');
    await signInWithEmulator(pageA, {
      displayName: 'Members Owner',
      email: `e2e-members-a-${stamp}@example.com`,
    });
    await acceptConsentOnScreen(pageA);

    await pageA.getByRole('link', { name: 'Communities' }).click();
    await pageA.getByLabel('Community name').fill('Masjid Members');
    await pageA.getByLabel('Timezone').selectOption('Europe/Stockholm');
    const createdCommunity = pageA.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === '/v1/communities' && res.request().method() === 'POST',
    );
    await pageA.getByRole('button', { name: 'Create community' }).click();
    expect((await createdCommunity).status()).toBe(201);
    const communityRow = pageA.getByRole('listitem').filter({ hasText: 'Masjid Members' });
    await expect(communityRow).toBeVisible();

    const createdInvite = pageA.waitForResponse(
      (res) =>
        /\/v1\/t\/[^/]+\/invites$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'POST',
    );
    await communityRow.getByRole('button', { name: 'Invite' }).click();
    expect((await createdInvite).status()).toBe(201);

    const href = await pageA.locator('.invite-dialog').getByRole('link').getAttribute('href');
    expect(href).toBeTruthy();

    await pageB.goto(href ?? '/');
    await expect(pageB.getByText('Masjid Members', { exact: true })).toBeVisible();
    await signInWithEmulator(pageB, {
      displayName: 'Members Joiner',
      email: `e2e-members-b-${stamp}@example.com`,
    });
    await acceptConsentOnScreen(pageB);
    await expect(pageB.getByText('Masjid Members', { exact: true })).toBeVisible();

    const accepted = pageB.waitForResponse(
      (res) =>
        /\/v1\/invites\/[^/]+\/accept$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'POST',
    );
    await pageB.getByRole('button', { name: 'Join' }).click();
    expect((await accepted).status()).toBe(201);

    await pageA.getByRole('button', { name: 'Close' }).click();
    await communityRow.getByRole('link', { name: 'Members' }).click();
    await expect(pageA.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(pageA.getByText('Members Owner')).toBeVisible();
    await expect(pageA.getByText('Members Joiner')).toBeVisible();

    const joinerRow = pageA.locator('.members__item').filter({ hasText: 'Members Joiner' });
    const roleSelect = joinerRow.getByLabel('Role');
    // Owner may assign Owner; admin cannot. A is the sole owner, so Owner is offered.
    await expect(roleSelect.locator('option', { hasText: 'Owner' })).toHaveCount(1);
    await roleSelect.selectOption({ label: 'Editor' });
    const patched = pageA.waitForResponse(
      (res) =>
        /\/v1\/t\/[^/]+\/members\/[^/]+$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'PATCH',
    );
    await joinerRow.getByRole('button', { name: 'Save' }).click();
    expect((await patched).status()).toBe(200);
    await expect(joinerRow.getByText('Editor', { exact: true }).first()).toBeVisible();

    await pageB.getByRole('link', { name: 'Communities' }).click();
    const rowB = pageB.getByRole('listitem').filter({ hasText: 'Masjid Members' });
    await expect(rowB).toBeVisible();
    await expect(rowB.getByRole('link', { name: 'Members' })).toHaveCount(0);

    const left = pageB.waitForResponse(
      (res) =>
        /\/v1\/t\/[^/]+\/leave$/.test(new URL(res.url()).pathname) &&
        res.request().method() === 'POST',
    );
    await rowB.getByRole('button', { name: 'Leave' }).click();
    await rowB.getByRole('button', { name: 'Leave community' }).click();
    expect((await left).status()).toBe(204);
    await expect(pageB.getByRole('listitem').filter({ hasText: 'Masjid Members' })).toHaveCount(0);

    await pageA.reload();
    await expect(pageA.getByText('Members Joiner')).toHaveCount(0);
    await expect(pageA.getByText('Members Owner')).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
