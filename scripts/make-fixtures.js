// Generates fixtures/demo-2026.json: a deterministic, made-up 2026 season (results up to round 19) in the old
// app's data format, so the app can be developed and demoed before the real export arrives.
// Usage: node scripts/make-fixtures.js

import { readFileSync, writeFileSync } from 'node:fs';

const season = JSON.parse(readFileSync(new URL('../seed/season-2026.json', import.meta.url)));
const LAST_RESULT_ROUND = 19;

let seed = 2026;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const strength = { norris: 10, piastri: 9, verstappen: 9, russell: 8, leclerc: 7, hamilton: 6, antonelli: 6, albon: 3, sainz: 3, alonso: 3, hadjar: 3, gasly: 2, lawson: 2, bearman: 2, hulkenberg: 2, ocon: 1, stroll: 1, bortoleto: 1, lindblad: 1, colapinto: 1, bottas: 1, perez: 1, hirakawa: 0.3 };
const drivers = season.drivers.map((d) => d.id);
const teamOf = Object.fromEntries(season.drivers.map((d) => [d.id, d.team]));

function pick(weights, exclude = []) {
  const pool = drivers.filter((d) => !exclude.includes(d));
  const total = pool.reduce((a, d) => a + (weights[d] ?? 1) ** 2, 0);
  let x = rand() * total;
  for (const d of pool) { x -= (weights[d] ?? 1) ** 2; if (x <= 0) return d; }
  return pool[pool.length - 1];
}
const order = (n, weights) => { const out = []; while (out.length < n) out.push(pick(weights, out)); return out; };
const iso = (date) => date.toISOString().replace('.000Z', 'Z');
const hoursBefore = (utc, h) => iso(new Date(new Date(utc).getTime() - h * 3600e3));

const predictions = {}, results = {}, sprintPredictions = {}, sprintResults = {};
for (const race of season.races) {
  const r = String(race.round);
  const hasResult = race.round <= LAST_RESULT_ROUND;
  const dnfDns = race.round >= 16;
  if (hasResult) {
    const top = order(10, strength);
    const dnf = dnfDns ? order(1 + Math.floor(rand() * 3), Object.fromEntries(drivers.map((d) => [d, 1]))).filter((d) => !top.includes(d)) : undefined;
    const dns = dnfDns ? (rand() < 0.4 ? [pick({}, [...top, ...(dnf || [])])] : []) : undefined;
    results[r] = {
      winner: top[0], podium: top.slice(0, 3), pole: rand() < 0.5 ? top[0] : pick(strength), fastestLap: pick(strength),
      bestConstructor: teamOf[top[0]], topTen: top, ...(dnfDns ? { dnf, dns } : {}), enteredAt: hoursBefore(race.raceStartUTC, -26),
    };
  }
  if (race.round <= LAST_RESULT_ROUND + 1) {
    predictions[r] = {};
    for (const p of season.players) {
      if (race.round === LAST_RESULT_ROUND + 1 && p.id === 'julia') continue; // Julia hasn't tipped Brazil yet
      if (rand() < 0.04) continue; // a forgotten tip now and then
      // Players are decent at this: lean towards the real outcome when it is known.
      const res = results[r];
      const podium = [];
      for (let i = 0; i < 3; i++) {
        const lean = res && rand() < 0.38 ? res.podium[i] : res && rand() < 0.25 ? res.podium[(i + 1) % 3] : null;
        podium.push(lean && !podium.includes(lean) ? lean : pick(strength, podium));
      }
      const late = race.round === 7 && p.id === 'thomas';
      predictions[r][p.id] = {
        winner: podium[0], podium,
        pole: res && rand() < 0.4 ? res.pole : rand() < 0.5 ? podium[0] : pick(strength),
        fastestLap: res && rand() < 0.25 ? res.fastestLap : pick(strength),
        bestConstructor: res && rand() < 0.5 ? res.bestConstructor : teamOf[podium[rand() < 0.7 ? 0 : 1]],
        ...(dnfDns ? { dnf: res?.dnf?.length && rand() < 0.3 ? res.dnf[0] : rand() < 0.8 ? pick({}, podium) : '', dns: res?.dns?.length && rand() < 0.15 ? res.dns[0] : rand() < 0.5 ? pick({}, podium) : '' } : {}),
        submittedAt: late ? hoursBefore(race.raceStartUTC, -0.2) : hoursBefore(race.raceStartUTC, 2 + Math.floor(rand() * 40)),
      };
      if (dnfDns && predictions[r][p.id].dnf && predictions[r][p.id].dnf === predictions[r][p.id].dns) predictions[r][p.id].dns = '';
    }
  }
  if (race.sprint && race.round <= LAST_RESULT_ROUND) {
    const top = order(3, strength);
    sprintResults[r] = { winner: top[0], podium: top, enteredAt: hoursBefore(race.sprintStartUTC, -3) };
    sprintPredictions[r] = {};
    for (const p of season.players) {
      const podium = [];
      for (let i = 0; i < 3; i++) { const lean = rand() < 0.35 ? top[i] : null; podium.push(lean && !podium.includes(lean) ? lean : pick(strength, podium)); }
      sprintPredictions[r][p.id] = { winner: podium[0], podium, submittedAt: hoursBefore(race.sprintStartUTC, 1 + Math.floor(rand() * 20)) };
    }
  }
}

const seasonPredictions = {
  thomas: { wdc: 'verstappen', wcc: 'mclaren', submittedAt: '2026-03-01T12:00:00Z' },
  julia: { wdc: 'norris', wcc: 'mclaren', submittedAt: '2026-03-02T09:00:00Z' },
  viktor: { wdc: 'russell', wcc: 'mercedes', submittedAt: '2026-03-05T21:00:00Z' },
};

const out = { _note: 'Made-up demo data, not real 2026 tips. Generated by scripts/make-fixtures.js.', predictions: { predictions }, sprintPredictions: { sprintPredictions }, seasonPredictions: { seasonPredictions }, results: { results }, sprintResults: { sprintResults } };
writeFileSync(new URL('../fixtures/demo-2026.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote fixtures/demo-2026.json');
