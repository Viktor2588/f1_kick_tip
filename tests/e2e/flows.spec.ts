// Core flows against the frozen clock (Sat 7 Nov 2026, 12:00 UTC – Brazil R20 open, R19 closed).
import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, name: string, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByText(name, { exact: true }).click();
  for (const d of '0000') await page.locator('.pad button', { hasText: d }).first().click();
  await page.waitForURL((u) => u.pathname === next);
}

async function pickSlot(page: Page, slot: string, driver: string) {
  await page.locator(`[data-slot=${slot}]`).click();
  const sheet = page.locator('dialog.sheet[open]');
  await sheet.getByRole('button', { name: new RegExp(driver) }).first().click();
  await expect(page.locator('dialog.sheet[open]')).toHaveCount(0);
}

test('wrong PIN is rejected, right PIN logs in', async ({ page }) => {
  await page.goto('/login');
  await page.getByText('Julia', { exact: true }).click();
  await page.locator('#pin').fill('1234');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('alert')).toContainText('PIN stimmt nicht');
  await login(page, 'Julia');
  await expect(page.getByLabel('Profil')).toBeVisible();
});

test('submit, revisit and change a race tip', async ({ page }) => {
  await login(page, 'Viktor', '/rennen/20');
  // Fresh tip: autoadvance P1 → P2 → P3 via the picker.
  await page.locator('[data-slot=p1]').click();
  await page.locator('dialog.sheet[open]').getByRole('button', { name: /Norris/ }).click();
  await page.locator('dialog.sheet[open]').getByRole('button', { name: /Verstappen/ }).click(); // P2 auto-opened
  await page.locator('dialog.sheet[open]').getByRole('button', { name: /Russell/ }).click(); // P3
  await page.locator('dialog.sheet[open]').getByRole('button', { name: /Norris/ }).click(); // Pole
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tipp abgeben' }).click();
  await expect(page.getByRole('status')).toContainText('Gespeichert');

  await page.reload();
  await expect(page.locator('[data-slot=p1]')).toContainText('Norris');
  await expect(page.locator('[data-slot=pole]')).toContainText('Norris');
  await expect(page.getByRole('button', { name: 'Gespeichert ✓' })).toBeDisabled();

  // Picking a driver already on the podium swaps the two slots.
  await pickSlot(page, 'p2', 'Russell');
  await expect(page.locator('[data-slot=p3]')).toContainText('Verstappen');
  await page.getByRole('button', { name: 'Änderung speichern' }).click();
  await expect(page.getByRole('status')).toContainText('Gespeichert');

  // Home shows the tip as done.
  await page.goto('/');
  await expect(page.getByText('✓ Renntipp abgegeben')).toBeVisible();
});

test("other players' open tips stay hidden, own tip visible", async ({ page }) => {
  await login(page, 'Thomas', '/rennen/20');
  const matrix = page.locator('table');
  // Thomas sees his own P1 pick, but locks for Julia.
  const row = matrix.locator('tbody tr').first();
  await expect(row.locator('td').nth(0).locator('.tag')).toBeVisible();
  await expect(row.locator('td').nth(1)).toContainText('🔒');
});

test('server refuses tips after the deadline and for anonymous users', async ({ page, baseURL }) => {
  const post = (path: string) =>
    page.request.post(path, {
      form: { p1: 'norris', p2: 'piastri', p3: 'leclerc' },
      headers: { origin: baseURL!, 'x-sveltekit-action': 'true' },
    });
  const anon = await post('/rennen/20?/race');
  expect(await anon.text()).toContain('Bitte zuerst anmelden');

  await login(page, 'Julia');
  const closed = await post('/rennen/19?/race');
  expect(await closed.text()).toContain('gesperrt');
  const forged = await post('/rennen/20?/race');
  expect(await forged.text()).toContain('success');
});

test('non-admins cannot reach admin', async ({ page }) => {
  await login(page, 'Julia');
  const res = await page.goto('/admin/19');
  expect(res?.status()).toBe(403);
});

test('admin result entry updates the standings', async ({ page }) => {
  await login(page, 'Viktor');
  await page.goto('/tabelle');
  const before = await page.locator('.pc').first().locator('.tot').innerText();

  // Clear R19 and re-enter it: standings drop, then come back.
  await page.goto('/admin/19');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Gelöscht.')).toBeVisible();
  await page.goto('/tabelle');
  const without = await page.locator('.pc').first().locator('.tot').innerText();
  expect(parseInt(without)).toBeLessThan(parseInt(before));

  await page.goto('/admin/19');
  for (const [slot, d] of [['p1', 'Verstappen'], ['p2', 'Hamilton'], ['p3', 'Antonelli'], ['pole', 'Hamilton'], ['fastestLap', 'Hamilton']]) {
    await pickSlot(page, slot, d);
  }
  await page.locator('[data-slot=bestConstructor]').click();
  await page.locator('dialog.sheet[open]').getByRole('button', { name: /^Ferrari/ }).click();
  await page.locator('[data-slot=dnf]').click();
  for (const d of ['Lindblad', 'Bearman', 'Bottas', 'Stroll', 'Alonso']) {
    await page.locator('dialog.sheet[open]').getByRole('button', { name: new RegExp(d) }).click();
  }
  await page.locator('dialog.sheet[open]').getByRole('button', { name: 'Fertig' }).click();
  await expect(page.locator('.preview')).toContainText('+10');
  await page.getByRole('button', { name: 'Ergebnis speichern' }).click();
  await expect(page.getByText('Ergebnis gespeichert ✓')).toBeVisible();
  await page.goto('/tabelle');
  await expect(page.locator('.pc').first().locator('.tot')).toHaveText(before.replace(/\s+/g, ''));
});

test('no horizontal scroll on any page at phone width', async ({ page }) => {
  for (const url of ['/', '/rennen', '/rennen/19', '/rennen/20', '/tabelle', '/saison', '/regeln', '/mehr', '/login']) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
