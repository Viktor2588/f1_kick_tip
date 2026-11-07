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
await browser.close();

if (problems.length) { console.error(`UI check FAILED (${problems.length}):\n- ` + problems.join('\n- ')); process.exit(1); }
console.log(`UI check OK: ${PAGES.length} pages × ${VIEWPORTS.length} widths × ${SCHEMES.length} colour schemes, no console errors, no horizontal scroll. Screenshots in ${out}/`);
