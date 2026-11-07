# Kick Tip 2026

Das F1-Tippspiel von Thomas, Julia und Viktor: vor jedem Rennen tippen, Punkte sammeln, Tabelle anschauen.

Rebuild #2 (branch `rebuild2-from-scratch`). One Cloudflare Worker serves the app and a small JSON API;
the data lives in Cloudflare D1 (SQLite). The database credential exists only on the server.

## Run locally

```bash
npm install
npm run dev
```

Opens on **http://127.0.0.1:5190**. On first start a local database is created and filled with a made-up demo
season (`fixtures/demo-2026.json`, results up to round 19). No Cloudflare account is needed for local work.

- `npm run db:reset` – wipe the local database and reload the demo season.
- `npm run import -- path/to/live-export.json` – load real data into the local database (see *Data import*).
- `npm run fixtures` – regenerate the demo season.

## Test

```bash
npm test                    # scoring rules, parity with the original 2026 scoring code, import
node scripts/ui-check.js    # with `npm run dev` running: every page at 375px and 1280px, dark + light,
                            # fails on console errors or horizontal scrolling; screenshots in .wrangler/screens/
```

`test/reference/legacy-scoring.js` is a verbatim copy of the old `js/scoring.js`. The parity tests run it side by side
with the new engine (`src/shared/scoring.js`) on fixtures and on 10,000 random inputs, and include every case from the
old `test-scoring.html`.

## Data import

`scripts/load.js` accepts the old app's data in either shape:
- app format (what `fetchAllData()` returned, or the `data/*.json` files merged into one object), or
- raw table rows (`race_predictions`, `sprint_predictions`, `season_predictions`, `race_results`, `sprint_results`).

Calendar, drivers and teams come from `seed/season-2026.json`. Before writing anything the loader computes the
standings with the **original** scoring code on the source data and with the new engine on the converted rows, and
stops if anything differs (totals, tiebreak order or any per-race breakdown).

## Deploy (not done yet – needs Viktor's go-ahead)

```bash
npx wrangler login
npx wrangler d1 create f1-kick-tip          # put the printed database_id into wrangler.jsonc
npx wrangler d1 migrations apply DB --remote
node scripts/load.js live-export.json --remote
npm run deploy
```

Free tier is plenty for this game. No secrets go into the repository.

## Layout

```
src/shared/   scoring engine, row ↔ game conversion, import (used by Worker, browser and scripts)
src/worker/   Cloudflare Worker: JSON API (/api/*), static files via the assets binding
src/client/   browser app (Preact + htm), bundled to public/app.js by esbuild
public/       index.html, app.css, icon, manifest
migrations/   D1 schema
seed/         2026 calendar, drivers, teams, players
fixtures/     demo season and the old app's test data
scripts/      dev server, build, data loader, browser check
test/         node --test suites; reference/ holds the original scoring code for parity
```
