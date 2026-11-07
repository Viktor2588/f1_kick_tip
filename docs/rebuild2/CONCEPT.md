# F1 Kick Tip — Rebuild #2: Concept

Branch `rebuild2-from-scratch`, preview port 5190. Written 2026-11-07 by dev-build@f1-rebuild2.

## The problem with today's app (what drives the design)
- The browser talks **directly to Neon with the owner connection string** (`js/api.js`). Anyone who opens DevTools
  can read, change or delete all data. This is the biggest thing to fix.
- Identity is "pick your name" with no check, so anyone can tip as anyone. Deadlines are only checked when scoring;
  the server never refuses a late tip, and `submittedAt` comes from the browser clock.
- Results are typed in by hand on an admin page; the update note is a hard-coded constant edited per push.

## Stack (and why)
**One Cloudflare Worker serving the app and a small JSON API, with Cloudflare D1 (SQLite) as the database.**
- Free tier covers a friends' game many times over; one `wrangler deploy`, no server to look after, HTTPS by default.
- The database credential lives only in the Worker binding, never in the browser or in git.
- Local dev needs no cloud account: `npm run dev` runs the same Worker with a local D1 on **port 5190**.
- Frontend: plain ES modules + **Preact + htm** (≈5 kB), bundled by esbuild. Mobile-first, installable PWA.
- Tests: `node --test` (no extra framework). Scoring, standings, deadline rules, import, API.
- Scoring lives in one pure module shared by Worker and client, so the numbers on screen and on the server are the
  same code.

## Data model (SQLite)
`players(id, name, emoji, color, is_admin, token_hash)` ·
`teams(id, name, color)` · `drivers(id, name, number, team_id, active)` (substitutes like Hirakawa are just drivers) ·
`races(round, name, country, country_code, circuit, city, date, quali_start, sprint_start, race_start, dnf_dns)` ·
`race_tips(round, player_id, winner, p1, p2, p3, pole, fastest_lap, best_constructor, dnf, dns, submitted_at)` ·
`sprint_tips(round, player_id, winner, p1, p2, p3, submitted_at)` ·
`season_tips(player_id, wdc, wcc, submitted_at)` ·
`race_results(round, winner, p1, p2, p3, pole, fastest_lap, best_constructor, top_ten JSON, dnf JSON|null, dns JSON|null, entered_at)` ·
`sprint_results(round, winner, p1, p2, p3, entered_at)` · `season_final(wdc, wcc)` · `news(id, date, items JSON)`.
Columns mirror today's rows 1:1 (including `winner` and `p1` separately, which the sprint bonus relies on) so the
import is lossless and parity is provable.

## Top 5 ideas
1. **Personal links instead of a password or name picker.** Each player gets a private link once
   (`/join/<token>`); the browser remembers it. The server stamps `submittedAt` and **refuses tips after lights-out**.
   Admin rights (results, players) only for Viktor's link.
2. **Tips stay hidden until lights-out.** You see who has tipped (✓), not what, until the session starts. Then
   everyone's tip is revealed side by side. No copying, more suspense. (Display-only; scoring unchanged. Viktor can veto.)
3. **"Tipp in 30 Sekunden":** one mobile screen, big driver chips in team colours, tap to fill P1→P2→P3, pole,
   fastest lap, constructor; sprint and DNF/DNS appear only when relevant. Countdown and deadline always visible.
4. **Season story:** standings with movement arrows, a points-over-the-season chart, per-race breakdown showing exactly
   where each point came from, and "what you'd need" for the remaining races.
5. **Less admin work:** results form prefilled from a public F1 results API (Jolpica, fetched server-side) that Viktor
   only confirms; an in-app "Neuigkeiten" feed replaces the hard-coded update note; calendar feed (ICS) with tip
   deadlines for phone reminders.

## Left out (deliberately)
- No accounts/passwords/e-mail, no push notifications in v1 (ICS + PWA instead), no chat (WhatsApp exists), no
  multi-season UI (data model allows it later), no change to any scoring rule.

## Data migration
- Importer (`npm run import -- live-export.json`) accepts today's app format (the shape `fetchAllData()` returns /
  `data/*.json`) and raw table rows (`race_predictions`, `race_results`, …). Season/calendar/drivers come from
  today's `season.json`.
- A parity test computes standings with the **original** `js/scoring.js` and with the new engine on the imported data
  and requires identical totals, tiebreak order and per-race breakdowns.
- Never touches Neon. Until `live-export.json` arrives, everything runs on fixtures (`data/test/*` plus generated cases).

## Git history and secrets
This branch was cut from `main`, so its history already contains the Neon connection string in `js/api.js`. The new
code never uses it, but "no credentials in the branch's history" can only be met by publishing the rebuild with fresh
history (orphan commit) at cut-over, and the Neon password should be rotated either way. Proposed in the cut-over plan;
Viktor decides.

## Slices
1. Foundation: project skeleton, D1 schema, scoring port + parity tests (incl. all `test-scoring.html` cases), fixture
   import, `npm run dev` on 5190, read-only standings + calendar.
2. Tipping: personal links, race/sprint/season tip flow, server-side deadlines, hidden-until-lights-out.
3. Race pages & season story: reveal, breakdowns, chart, rules page.
4. Admin: results (with prefill), players/links, news feed.
5. Import of `live-export.json`, parity on real data, README, demo summary + cut-over plan.
