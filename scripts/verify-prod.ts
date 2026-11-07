// READ-ONLY check against the live Neon database: scores all real tips with the legacy engine
// and the new one and compares the standings. Writes nothing.
//   DATABASE_URL=postgresql://… npx vite-node scripts/verify-prod.ts
import { season } from '../src/lib/domain/season';
import { calculateStandings } from '../src/lib/domain/scoring';
import { neonStore } from '../src/lib/server/store/neon';
// plain JS oracle (allowJs)
import * as legacy from '../tests/unit/legacy-scoring.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL setzen');
const data = await neonStore(url).load();

// Rebuild the legacy shapes from the loaded data (winner = P1, '' for blanks, like the old client).
const s = (v: string | null) => v ?? '';
const legacyPreds = Object.fromEntries(Object.entries(data.raceTips).map(([r, byP]) => [r, Object.fromEntries(Object.entries(byP).map(([p, t]) => [p, {
  winner: s(t.podium[0]), podium: t.podium.map(s), pole: s(t.pole), fastestLap: s(t.fastestLap), bestConstructor: s(t.bestConstructor), dnf: s(t.dnf), dns: s(t.dns), submittedAt: t.submittedAt,
}]))]));
const legacySprint = Object.fromEntries(Object.entries(data.sprintTips).map(([r, byP]) => [r, Object.fromEntries(Object.entries(byP).map(([p, t]) => [p, { winner: s(t.podium[0]), podium: t.podium.map(s), submittedAt: t.submittedAt }]))]));
const legacyRes = Object.fromEntries(Object.entries(data.raceResults).map(([r, x]) => [r, {
  winner: s(x.podium[0]), podium: x.podium.map(s), pole: s(x.pole), fastestLap: s(x.fastestLap), bestConstructor: s(x.bestConstructor), dnf: x.dnf ?? undefined, dns: x.dns ?? undefined,
}]));
const legacySprintRes = Object.fromEntries(Object.entries(data.sprintResults).map(([r, x]) => [r, { winner: s(x.podium[0]), podium: x.podium.map(s) }]));

const old = legacy.calculateStandings(season, { predictions: legacyPreds }, { sprintPredictions: legacySprint }, { results: legacyRes }, { sprintResults: legacySprintRes }, { seasonPredictions: {} }, null);
const neu = calculateStandings(season, data);

console.log(`${Object.keys(data.raceResults).length} Rennergebnisse, ${Object.values(data.raceTips).reduce((n, x) => n + Object.keys(x).length, 0)} Renntipps\n`);
let same = true;
for (const n of neu) {
  const o = old.find((x: { playerId: string }) => x.playerId === n.playerId);
  const ok = o.totalPoints === n.totalPoints;
  same &&= ok;
  console.log(`${ok ? '✓' : '✗'} ${n.playerId.padEnd(8)} alt ${String(o.totalPoints).padStart(4)}  neu ${String(n.totalPoints).padStart(4)}`);
  if (!ok) {
    for (const round of Object.keys(n.raceScores)) {
      if (o.raceScores[round]?.total !== n.raceScores[Number(round)].total) {
        console.log(`    R${round}: alt ${o.raceScores[round]?.total}, neu ${n.raceScores[Number(round)].total}`);
      }
    }
  }
}
console.log(same ? '\nIdentisch.' : '\nAbweichung (siehe oben). Erwartet nur, wenn ein Ergebnisfeld leer war und der Tipp auch.');
process.exit(same ? 0 : 1);
