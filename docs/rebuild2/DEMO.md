# Kick Tip – Rebuild #2: Demo summary

For Viktor. Branch `rebuild2-from-scratch` (worktree `~/privat/rigtest/f1_kick_tip-rebuild2`).
Nothing is pushed, merged or deployed.

## Try it

```bash
cd ~/privat/rigtest/f1_kick_tip-rebuild2
npm install
npm run dev                         # → http://127.0.0.1:5190 (made-up demo season, results up to Mexico)
npm run links -- --admin viktor     # personal links in .wrangler/links.txt – open yours to tip / use Admin
```

Screenshots: `screens/` next to this file (375px phone and desktop, dark and light), e.g.
`start-mobile-dark.png`, `flow-tip-mobile.png` (tap-to-tip), `rennen-19-ergebnis-mobile-light.png` (reveal with points),
`tabelle-desktop-dark.png`, `admin-mobile.png`.

## Review status

- Slice 1 (foundation, scoring parity, read-only pages, commit `42e8c2e`): **passed independent QA** (dev-review).
- Slice 2 (links, tipping, hidden tips, admin, calendar, commit `8a33eb5`): **not independently reviewed** – you asked
  to skip review (no review budget this month). Checked by me only: 47 tests, the full browser matrix including a real
  tipping flow and the admin page at 375px and desktop, and live requests against the running server
  (anonymous tip → 401, admin → 401, invalid link → no cookie, no tokens or hashes in the API, others' open tips hidden,
  no credentials in the bundle).

## What's new compared with today's app

| Today | Rebuild #2 |
|---|---|
| Browser holds the Neon **owner** connection string – anyone can read/alter/delete all data | Database only reachable through a small server API; no credential in the browser or in git |
| "Pick your name" – anyone can tip as anyone | Personal link per player (only a hash stored); Viktor can replace a link from Admin |
| Deadline only checked when scoring; time comes from the browser | Server stamps the time and refuses tips after lights-out |
| Everyone can see others' tips before the race | Tips hidden until the session starts, then revealed side by side with hits and points |
| Dropdown forms | Tap-to-tip on one screen: team-coloured driver chips, auto-advance, "Letzten Tipp übernehmen", draft kept offline |
| Results typed in by hand | "Vorschlag laden" fills the result from the public F1 results API (checked on real 2026 rounds); Viktor confirms |
| Update note hard-coded per push | "Neuigkeiten" posted from Admin, shown on the start page |
| – | Points-over-the-season chart, position moves, best tipper of the weekend 👑, accuracy |
| – | Calendar subscription with a reminder 2 h before each tip deadline |
| – | Installable on the phone home screen; dark and light mode |

Scoring is unchanged and proven: the original `js/scoring.js` runs side by side with the new engine in the tests
(all `test-scoring.html` cases, fixtures, 10,000 random inputs) and as a gate in the importer.

## Stack

One Cloudflare Worker (serves the page and the API) + Cloudflare D1 (SQLite). Free tier is far more than enough.
Preact + htm frontend (whole app ≈ 27 kB gzipped incl. CSS), German UI. `npm test` (47 tests) and `node scripts/ui-check.js --flows`
(real Chrome, 375px + desktop, incl. tipping and admin).

## Not done yet

- **Real-data parity:** waiting for `live-export.json` (recipe: `EXPORT-HOWTO.md`). The importer refuses to load if
  standings differ from the original code.
- **Deploy:** not done and not tested against a real Cloudflare account (needs your login and approval).
- No rate limit on the join links (192-bit tokens, guessing is not practical); no push notifications (calendar
  reminders instead); season-tip form only appears while the season tip is open (closed for 2026).
- `CLAUDE.md`'s update rule still points at `js/app.js`; with the rebuild it becomes "post a Neuigkeit in Admin".

## Proposed cut-over plan

1. **Export & check (local):** you create `live-export.json`; I import it locally. The gate must show identical
   standings; you compare with the current app.
2. **Set up hosting (your approval):** `wrangler login`, `wrangler d1 create f1-kick-tip`, migrations, deploy to
   `f1-kick-tip.<you>.workers.dev` (custom domain optional). Old app keeps running.
3. **Switch between two race weekends** (e.g. Monday after Las Vegas, before Katar): freeze the old app (or just
   agree "no tips there"), final export → `load.js --remote` (parity gate runs again), send each player their link
   via WhatsApp, post a Neuigkeit.
4. **Close the old door:** rotate the Neon password (it is in `main`'s git history and in the live page), then retire
   the old app or keep it read-only.
5. **Clean history:** publish the rebuild with fresh git history (orphan branch/new repo), because this branch
   inherits `main`'s history containing the old connection string.
6. **Rollback:** until step 4, the old app is untouched; switching back is just using the old URL again.

Alternative: run Las Vegas in parallel as a dry run (both apps), cut over for Katar; or keep 2026 on the old app
and start 2027 on the new one.
