---
intent: "A second, independent ground-up rebuild of F1 Kick Tip, so Viktor can compare two takes side by side."
owner: Viktor
id: OPR.99.0.3
---

# F1 Kick Tip — ground-up rebuild, round 2

Requested by Viktor, 2026-11-07: "start a fresh parallel build of this project in a different folder."

## Intent
F1 Kick Tip is a private F1 prediction game for a few friends (Thomas, Julia, Viktor; maybe more later).
Before each race (and sprint) players tip winner, podium, pole, fastest lap, best constructor, DNF/DNS;
once per season they tip the WDC and WCC. Points are scored, standings compared, banter happens.
Rebuild it from scratch: new architecture, new UX, new ideas, keeping the game itself (rules and
2026 season history) intact.

**This is an independent second take.** Another team already built one rebuild
(`rebuild-from-scratch`) and a UI-only refresh (`ui-mobile-first`). Do not read, copy or look at
those branches, worktrees, their mission folders (`missions/f1-kick-tip-ui`, `missions/f1-kick-tip-rebuild`)
or their previews (ports 8000, 8001, 5180). The value of this round is a genuinely different answer.

## Where
- Worktree (already created): `~/privat/rigtest/f1_kick_tip-rebuild2`
- Branch: `rebuild2-from-scratch` (from `main` @ 6609b25). Already in `.git/info/exclude`.
- Mission folder: `~/.openrig/workspace/missions/f1-kick-tip-rebuild2/`
- Preview port: **5190** (others are taken).
- The old code on `main` is reference only.

## Freedom (Viktor: don't hold back)
- Any stack, framework, build step, hosting model or architecture. Pick what makes the best product for a
  small friends' game that's easy to run and cheap/free to host; justify it in a few lines.
- Redesign the UX freely: mobile first, fast, delightful. New features welcome where they make the game
  more fun or less work.
- Restructure data and code freely.

## Must keep
1. **The game rules.** Same points as `js/scoring.js` for the same inputs (late submission = 0, sprint
   scoring, DNF/DNS from round 16, perfect-round bonus, season tips). Port `test-scoring.html`'s cases
   into the new test suite and keep them green.
2. **The 2026 season data and history.** Calendar, drivers (incl. substitutes), teams, and every
   existing prediction and result must import, with identical standings afterwards.
3. **German UI** for the players.

## Hard constraints
- **Never connect to the live Neon database.** The current app's owner connection string is hard-coded in
  `js/api.js`; do not use it. Real 2026 data arrives only as an export file Viktor provides
  (`live-export.json`, placed in this mission folder). Until then, build on fixtures.
- **No secrets in client code or in git.**
- Work only on `rebuild2-from-scratch`. **No push, merge, deploy or hosting change without Viktor's approval.**

## Process
1. **Concept first (short):** `CONCEPT.md` in the mission folder: stack, hosting, data model, top 5 ideas,
   what's left out, how data migrates. Send Viktor a one-paragraph summary. Heads-up, not a gate.
2. Build in vertical slices, each runnable locally.
3. Independent review of each slice by effect: browser at 375px and desktop, plus scoring parity.

## Done when
- Runs locally with one documented command; README covers run, test, deploy.
- Scoring parity tests pass; imported 2026 data (once provided) gives the same standings as the current app.
- Every player flow works at 375px and desktop, no console errors.
- No credentials in client bundles or in the branch's git history.
- Viktor gets a demo summary: screenshots, preview URL (port 5190), what's new, what's not done, and a
  proposed cut-over plan.
