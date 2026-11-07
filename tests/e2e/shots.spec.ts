// Not assertions: renders key screens to test-results/shots for a visual review.
import { test } from '@playwright/test';

const dir = 'test-results/shots';
test('screens', async ({ page }) => {
  for (const [name, url] of [['home-anon', '/'], ['race19', '/rennen/19'], ['calendar', '/rennen'], ['table', '/tabelle'], ['rules', '/regeln']]) {
    await page.goto(url);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  }
  await page.goto('/login?next=/rennen/20');
  await page.getByText('Viktor').click();
  await page.screenshot({ path: `${dir}/login.png` });
  for (const d of '0000') await page.locator('.pad button', { hasText: d }).first().click();
  await page.waitForURL((u) => u.pathname === '/rennen/20');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/race20-form.png`, fullPage: true });
  await page.locator('[data-slot=p1]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/picker.png` });
  await page.goto('/');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/home-viktor.png`, fullPage: true });
  await page.goto('/admin/19');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/admin19.png`, fullPage: true });
});
