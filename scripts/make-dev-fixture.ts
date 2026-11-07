// Builds fixtures/dev/game.json: real 2026 results (via the Jolpica importer) for every race
// before --until, plus seeded fake tips for the three players. Run: npx vite-node scripts/make-dev-fixture.ts
import { writeFileSync } from 'node:fs';
import { season } from '../src/lib/domain/season';
import { importRace, importSprint } from '../src/lib/server/jolpica';
import type { GameData, Podium, RaceTip } from '../src/lib/domain/types';

const until = new Date(process.argv[2] ?? '2026-11-07T12:00:00Z');
let seed = 7;
const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const FAV = ['norris', 'piastri', 'verstappen', 'russell', 'leclerc', 'hamilton', 'antonelli'];
const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
const guess = (truth: string | null, p: number) => (truth && r() < p ? truth : pick(FAV));
const skill: Record<string, number> = { thomas: 0.42, julia: 0.36, viktor: 0.4 };

function podiumGuess(truth: Podium, p: number): Podium {
  const out: string[] = [];
  for (const t of truth) {
    let d = guess(t, p);
    while (out.includes(d)) d = pick(FAV);
    out.push(d);
  }
  return out as Podium;
}

const data: GameData = { raceTips: {}, sprintTips: {}, seasonTips: {}, raceResults: {}, sprintResults: {} };
for (const race of season.races) {
  const key = String(race.round);
  const started = Date.parse(race.raceStartUTC) <= until.getTime();
  const res = started ? await importRace(race.round) : null;
  if (res) {
    data.raceResults[key] = {
      podium: res.podium, pole: res.pole, fastestLap: res.fastestLap, bestConstructor: res.bestConstructor,
      dnf: race.round >= season.rules.dnfFromRound ? res.dnf : null, dns: race.round >= season.rules.dnfFromRound ? res.dns : null,
      topTen: res.topTen, enteredAt: new Date(Date.parse(race.raceStartUTC) + 20 * 3600_000).toISOString(),
    };
  }
  if (race.sprint && race.sprintStartUTC && Date.parse(race.sprintStartUTC) <= until.getTime()) {
    const sp = await importSprint(race.round).catch(() => null);
    if (sp) data.sprintResults[key] = { podium: sp.podium, enteredAt: new Date(Date.parse(race.sprintStartUTC) + 3 * 3600_000).toISOString() };
  }
  const truth = data.raceResults[key];
  const upcoming = !started;
  if (upcoming && race.round !== 20) continue; // only the next race gets (partial) tips
  data.raceTips[key] = {};
  for (const p of season.players) {
    if (upcoming && p.id === 'viktor') continue; // leave Viktor's open tip to the UI
    if (r() < 0.05) continue; // somebody forgot
    const s = skill[p.id];
    const t: RaceTip = {
      podium: podiumGuess(truth?.podium ?? ['norris', 'verstappen', 'russell'], s),
      pole: guess(truth?.pole ?? null, s), fastestLap: guess(truth?.fastestLap ?? null, s * 0.6),
      bestConstructor: truth?.bestConstructor && r() < s + 0.15 ? truth.bestConstructor : pick(['mclaren', 'mercedes', 'redbull', 'ferrari']),
      dnf: race.round >= season.rules.dnfFromRound && r() < 0.8 ? (truth?.dnf?.length && r() < 0.25 ? truth.dnf[0] : pick(['stroll', 'alonso', 'bottas', 'colapinto'])) : null,
      dns: null,
      submittedAt: new Date(Date.parse(race.raceStartUTC) - (2 + Math.floor(r() * 60)) * 3600_000).toISOString(),
    };
    data.raceTips[key][p.id] = t;
  }
  if (race.sprint && data.sprintResults[key]) {
    data.sprintTips[key] = {};
    for (const p of season.players) {
      data.sprintTips[key][p.id] = {
        podium: podiumGuess(data.sprintResults[key].podium, skill[p.id]),
        submittedAt: new Date(Date.parse(race.sprintStartUTC!) - 5 * 3600_000).toISOString(),
      };
    }
  }
  process.stdout.write(`R${race.round} `);
  await new Promise((ok) => setTimeout(ok, 900));
}
data.seasonTips = {
  thomas: { wdc: 'verstappen', wcc: 'mclaren', submittedAt: '2026-03-01T12:00:00Z' },
  julia: { wdc: 'norris', wcc: 'ferrari', submittedAt: '2026-03-02T09:00:00Z' },
  viktor: { wdc: 'russell', wcc: 'mercedes', submittedAt: '2026-03-01T18:00:00Z' },
};
writeFileSync('fixtures/dev/game.json', JSON.stringify(data, null, 1));
console.log(`\n${Object.keys(data.raceResults).length} Rennergebnisse, ${Object.keys(data.sprintResults).length} Sprints`);
