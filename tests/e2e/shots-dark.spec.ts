import { test } from '@playwright/test';
test.use({ colorScheme: 'dark' });
test('dark screens', async ({ page }) => {
  for (const [name, url] of [['dark-home', '/'], ['dark-race19', '/rennen/19'], ['dark-table', '/tabelle']]) {
    await page.goto(url);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/shots/${name}.png` });
  }
});
