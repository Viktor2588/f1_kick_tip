// Browser check of every page at phone (375px) and desktop width against a running app (default http://127.0.0.1:5190).
// Fails on console errors, failed requests, uncaught exceptions or horizontal scrolling. Saves screenshots.
//
//   node scripts/ui-check.js [--base http://127.0.0.1:5190] [--out .wrangler/screens]
// Uses the locally installed Google Chrome (playwright-core, no browser download).

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', 'http://127.0.0.1:5190');
const out = opt('--out', '.wrangler/screens');
mkdirSync(out, { recursive: true });

const PAGES = [
  { path: '/', name: 'start', ready: '.hero' },
  { path: '/tabelle', name: 'tabelle', ready: '.table' },
  { path: '/rennen', name: 'rennen', ready: '.calendar' },
  { path: '/regeln', name: 'regeln', ready: '.rules-table' },
  { path: '/rennen/19', name: 'rennen-19-ergebnis', ready: '.reveal' },
  { path: '/rennen/20', name: 'rennen-20-offen', ready: '.tipstatus' },
];
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 860 },
];
const SCHEMES = (opt('--schemes', 'dark,light')).split(',');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problems = [];
for (const vp of VIEWPORTS) for (const scheme of SCHEMES) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, colorScheme: scheme, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const where = () => `${vp.name}/${scheme} ${page.url().replace(base, '') || '/'}`;
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${where()}: console ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${where()}: uncaught: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`${where()}: request failed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${where()}: HTTP ${r.status()} ${r.url()}`); });

  for (const p of PAGES) {
    await page.goto(base + p.path, { waitUntil: 'networkidle' });
    await page.waitForSelector(p.ready, { timeout: 5000 }).catch(() => problems.push(`${where()}: "${p.ready}" never appeared`));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) problems.push(`${where()}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `${out}/${p.name}-${vp.name}-${scheme}.png`, fullPage: true });
  }

  // Client-side navigation through the menu works without reload.
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const nav = vp.name === 'mobile' ? '.tabbar' : '.topnav';
  await page.click(`${nav} a[href="/tabelle"]`);
  await page.waitForSelector('.table', { timeout: 3000 }).catch(() => problems.push(`${where()}: menu navigation to /tabelle failed`));
  await ctx.close();
}

// Player flow: open a personal link, tip the next race by tapping, save, see it stored. Changes the local DB.
if (args.includes('--flows')) {
  const { readFileSync, existsSync } = await import('node:fs');
  if (!existsSync('.wrangler/links.txt')) problems.push('flows: no .wrangler/links.txt – run npm run links first');
  else {
    const links = Object.fromEntries(readFileSync('.wrangler/links.txt', 'utf8').trim().split('\n').map((l) => l.split('\t')));
    const who = opt('--player', 'julia');
    const round = opt('--round', '20');
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`flow ${vp.name}: console error: ${m.text()}`); });
      page.on('pageerror', (e) => problems.push(`flow ${vp.name}: uncaught: ${e.message}`));
      await page.goto(links[who].replace('http://127.0.0.1:5190', base), { waitUntil: 'networkidle' });
      await page.waitForSelector('.toast', { timeout: 3000 }).catch(() => problems.push(`flow ${vp.name}: no welcome toast`));
      if (!(await page.locator('.me-btn').count())) problems.push(`flow ${vp.name}: not signed in after link`);
      await page.goto(`${base}/rennen/${round}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.tipform', { timeout: 3000 }).catch(() => problems.push(`flow ${vp.name}: no tip form`));
      // Pick a different podium per viewport so the second run is a change.
      const SETS = [['Norris', 'Piastri', 'Russell', 'Norris', 'Verstappen'], ['Russell', 'Norris', 'Leclerc', 'Russell', 'Piastri']];
      const current = await page.evaluate(async (r) => (await (await fetch('/api/state')).json()).raceTips[r], round);
      const picks = SETS.find((set) => set[0].toLowerCase() !== current?.[who]?.winner);
      // Click each slot explicitly (auto-advance depends on what is already filled), then the driver.
      for (const [i, name] of picks.entries()) {
        await page.locator('.slot').nth(i).click();
        await page.locator('.driver-pick', { hasText: name }).first().click();
      }
      await page.locator('.slot').nth(5).click();
      await page.locator('.team-pick', { hasText: 'McLaren' }).click();
      await page.screenshot({ path: `${out}/flow-tip-${vp.name}.png`, fullPage: true });
      await page.locator('.submitbar button[type=submit]').click();
      const t = await page.waitForSelector('.toast', { timeout: 4000 }).then((el) => el.textContent()).catch(() => null);
      if (!t || !/Tipp (abgegeben|geändert)/.test(t)) problems.push(`flow ${vp.name}: save toast missing (got ${t})`);
      await page.waitForSelector('.saved-note', { timeout: 3000 }).catch(() => problems.push(`flow ${vp.name}: saved note missing after save`));
      await page.screenshot({ path: `${out}/flow-saved-${vp.name}.png`, fullPage: true });
      const st = await page.evaluate(async (r) => (await (await fetch('/api/state')).json()).raceTips[r], round);
      if (st?.[who]?.winner !== picks[0].toLowerCase()) problems.push(`flow ${vp.name}: stored winner is ${st?.[who]?.winner}, expected ${picks[0].toLowerCase()}`);
      const others = Object.entries(st || {}).filter(([pid]) => pid !== who);
      if (others.some(([, t]) => !t.hidden)) problems.push(`flow ${vp.name}: other players' open tips are visible`);
      await ctx.close();
    }
    // Admin: Viktor opens the admin page, sees the result editor, posts and removes a news line.
    if (links.viktor) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        const page = await ctx.newPage();
        page.on('console', (m) => { if (m.type() === 'error') problems.push(`admin ${vp.name}: console error: ${m.text()}`); });
        page.on('pageerror', (e) => problems.push(`admin ${vp.name}: uncaught: ${e.message}`));
        await page.goto(links.viktor.replace('http://127.0.0.1:5190', base), { waitUntil: 'networkidle' });
        await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.picker', { timeout: 3000 }).catch(() => problems.push(`admin ${vp.name}: result editor missing`));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) problems.push(`admin ${vp.name}: horizontal overflow ${overflow}px`);
        await page.screenshot({ path: `${out}/admin-${vp.name}.png`, fullPage: true });
        await page.locator('.segmented button', { hasText: 'Neuigkeiten' }).click();
        const line = `UI-Check ${vp.name}`;
        await page.fill('textarea', line);
        await page.locator('button', { hasText: 'Veröffentlichen' }).click();
        await page.waitForSelector(`.news-admin li:has-text("${line}")`, { timeout: 3000 }).catch(() => problems.push(`admin ${vp.name}: news not listed after posting`));
        await page.locator(`.news-admin li:has-text("${line}") button`).click();
        await page.waitForTimeout(400);
        if (await page.locator(`.news-admin li:has-text("${line}")`).count()) problems.push(`admin ${vp.name}: news not removed`);
        await page.locator('.segmented button', { hasText: 'Links' }).click();
        await page.screenshot({ path: `${out}/admin-links-${vp.name}.png`, fullPage: true });
        await ctx.close();
      }
    }
  }
}
await browser.close();

if (problems.length) { console.error(`UI check FAILED (${problems.length}):\n- ` + problems.join('\n- ')); process.exit(1); }
console.log(`UI check OK: ${PAGES.length} pages × ${VIEWPORTS.length} widths × ${SCHEMES.length} colour schemes, no console errors, no horizontal scroll. Screenshots in ${out}/`);
