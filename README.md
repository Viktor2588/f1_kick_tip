# F1 Kick Tip

Private Formel-1-Tippspiel für Thomas, Julia und Viktor. Vor jedem Rennen (und Sprint) tippt jeder Sieger,
Podium, Pole, schnellste Runde, besten Konstrukteur und optional DNF/DNS; einmal pro Saison Weltmeister und
Konstrukteurs-Weltmeister. Die Regeln stehen in der App unter **Regeln**.

This is the rebuilt version (SvelteKit + Postgres). The original static app is kept in `legacy/` as reference.

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

That's all: data lives in an embedded Postgres (PGlite) in `.data/pglite`, created and filled on first start with
the 2026 calendar, teams, drivers and players (`legacy/data/season.json`) plus tips and results:

- the real data, if `LIVE_EXPORT=/path/to/live-export.json` points to an export of the old database, or
- otherwise the old demo data (`legacy/data/test`).

To start over, stop the server and delete `.data/`. Sign in locally with `/dev/login/<thomas|julia|viktor>`
(only in `npm run dev`).

## Test

```bash
npm test             # scoring rules, parity with legacy/js/scoring.js, import, tips, results, secrecy
npm run check        # type check
```

The parity tests run the old `legacy/js/scoring.js` and the new `src/lib/scoring.ts` side by side (20,000 random
cases, random seasons, demo data) and must give identical points and standings. With `LIVE_EXPORT` set they
also compare the real season through the new database.

## How it works

| Where | What |
|---|---|
| `src/lib/scoring.ts` | The rules. Points are always calculated, never stored. |
| `src/lib/server/db/` | Schema, import of legacy data, seeding |
| `src/lib/server/views.ts` | Page data. Other players' tips stay on the server until the deadline. |
| `src/lib/server/tips.ts`, `results.ts` | Saving tips/results; the server enforces deadlines and stamps times |
| `src/lib/server/auth.ts` | Personal login links; only hashes of tokens are stored |
| `src/routes/` | Pages: Übersicht, Rennen, Saison, Statistik, Regeln, Admin; `/kalender.ics` feed |

- **Login:** the admin creates a personal link per player (Admin → Login-Links). Opening it once signs the player in
  for 180 days. A new link signs that player out everywhere.
- **Admin:** players with `is_admin` (Viktor by default) enter results, issue links and set the champions.
- **Calendar:** `/kalender.ics` lists every tip deadline with a reminder 2 hours before.

## Deploy (not done yet — needs Viktor's OK)

Proposed: Vercel Hobby or any Node host + a **new** Neon Postgres database. Steps are in the cut-over plan
(`~/.openrig/workspace/missions/f1-kick-tip-rebuild/CUTOVER.md`). Notes:

- Database credentials only as server environment variables, never in the code.
- adapter-node needs `ORIGIN=https://<your-domain>` (or PROTOCOL/HOST headers), otherwise form posts are rejected.
- The Neon driver for production is not wired up yet (local PGlite only); it is a small change in
  `src/lib/server/db/index.ts` at cut-over.

## Update-Nachricht

The repo rule in `CLAUDE.md` (replace `LATEST_UPDATE` in `js/app.js` before each push) belongs to the legacy app.
When the rebuild ships, the update notice moves into the new app; until then it does not apply to this branch.
