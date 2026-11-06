import { test, expect, type Page } from '@playwright/test';

// Demo mode with a fixed clock: Saturday before the Brazil GP (round 20).
const NOW = '2026-11-07T12:00:00Z';
const url = (hash: string) => `/?now=${NOW}#/${hash}`;
const SHOTS = process.env.SHOTS_DIR;

async function as(page: Page, player: string | null) {
  await page.addInitScript((p) => {
    if (p) localStorage.setItem('f1_player', p);
    localStorage.setItem('f1_seen_update', 'x');
  }, player);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
});

test('first visit asks who is playing', async ({ page }) => {
  await as(page, null);
  await page.goto(url(''));
  const sheet = page.getByRole('dialog', { name: 'Wer bist du?' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /Viktor/ }).click();
  await expect(page.getByRole('heading', { name: /Servus Viktor/ })).toBeVisible();
  await expect(page.getByText('Jetzt tippen')).toBeVisible();
});

test('full race tip flow with auto-advance, swap and edit', async ({ page }) => {
  await as(page, 'viktor');
  await page.goto(url('tipp/20'));
  await expect(page.getByRole('heading', { name: /Brasilien/ })).toBeVisible();

  await page.getByRole('button', { name: /Rennsieger/ }).click();
  const sheet = page.getByRole('dialog');
  for (const [title, driver] of [['Rennsieger', 'Norris'], ['Platz 2', 'Piastri'], ['Platz 3', 'Verstappen'], ['Pole Position', 'Russell'], ['Schnellste Runde', 'Leclerc']]) {
    await expect(sheet.getByRole('heading', { name: title })).toBeVisible();
    await sheet.getByRole('button', { name: new RegExp(driver) }).click();
  }
  await expect(sheet.getByRole('heading', { name: 'Bester Konstrukteur' })).toBeVisible();
  await sheet.getByRole('button', { name: /McLaren/ }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: /Tipp abgeben/ }).click();
  await expect(page.getByRole('heading', { name: 'Tipp ist drin!' })).toBeVisible();

  // Edit: put Norris on P2 → he swaps with Piastri.
  await page.getByRole('button', { name: 'Ändern' }).click();
  await page.getByRole('button', { name: /Platz 2/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Norris/ }).click();
  await expect(page.getByRole('button', { name: /Rennsieger.*Piastri/ })).toBeVisible();
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Tipp ist drin!' })).toBeVisible();

  // Survives a reload (demo data persists) and shows on the home screen.
  await page.goto(url(''));
  await expect(page.getByText('Dein Tipp steht')).toBeVisible();
});

test('other players tips stay hidden before the start', async ({ page }) => {
  await as(page, 'viktor');
  await page.goto(url('rennen/20'));
  await expect(page.getByText('Tipps · verdeckt bis Start')).toBeVisible();
  await expect(page.getByLabel('verdeckt').first()).toBeVisible();
});

test('after the start everything is revealed and the editor is locked', async ({ page }) => {
  await as(page, 'viktor');
  await page.goto(`/?now=2026-11-08T18:00:00Z#/tipp/20`);
  await expect(page.getByText(/Tippschluss war/)).toBeVisible();
});

test('admin result entry scores the round', async ({ page }) => {
  await as(page, 'viktor');
  await page.goto(url('admin/20'));
  const pick = async (slot: string, name: string) => {
    await page.getByRole('button', { name: new RegExp(`^${slot}`) }).click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(name) }).click();
  };
  await pick('P1', 'Norris');
  await pick('P2', 'Piastri');
  await pick('P3', 'Verstappen');
  await pick('Pole', 'Russell');
  await pick('SR', 'Leclerc');
  await pick('Team', 'McLaren');
  await page.getByRole('button', { name: 'Rennergebnis speichern' }).click();
  await expect(page.getByText('Ergebnis gespeichert')).toBeVisible();
  await page.goto(url('rennen/20'));
  await expect(page.getByText('Ergebnis & Tipps')).toBeVisible();
});

test('no horizontal scrolling on any main page', async ({ page }) => {
  await as(page, 'viktor');
  for (const h of ['', 'rennen', 'rennen/19', 'rennen/17', 'tipp/20', 'tabelle', 'regeln', 'admin', 'admin/17']) {
    await page.goto(url(h));
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `#/${h}`).toBeLessThanOrEqual(0);
  }
});

test('@visual screenshots', async ({ page }, info) => {
  test.skip(!SHOTS, 'set SHOTS_DIR to capture');
  await as(page, 'viktor');
  const shot = async (name: string, full = true) => page.screenshot({ path: `${SHOTS}/${info.project.name}-${name}.png`, fullPage: full });
  for (const [name, h] of [['home', ''], ['races', 'rennen'], ['race19', 'rennen/19'], ['race17-sprint', 'rennen/17'], ['standings', 'tabelle'], ['rules', 'regeln'], ['tip', 'tipp/20'], ['admin', 'admin/20']]) {
    await page.goto(url(h));
    await page.waitForTimeout(400);
    await shot(name);
  }
  await page.goto(url('tipp/20'));
  await page.getByRole('button', { name: /Rennsieger/ }).click();
  await page.waitForTimeout(400);
  await shot('picker', false);
});
