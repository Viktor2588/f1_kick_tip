// Load 2026 data into the database and prove the standings did not change.
//
//   node scripts/load.js <data.json> [--season seed/season-2026.json] [--reset] [--remote]
//
// <data.json> is either the old app's data (fetchAllData() shape or data/*.json shape merged into one object) or raw
// table rows (race_predictions, race_results, ...). Before writing anything it computes the standings twice — with the
// ORIGINAL scoring code (test/reference/legacy-scoring.js) on the source data and with the new engine on the converted
// rows — and refuses to load if they differ.
//
// Default target is the LOCAL development database. --remote writes to the deployed D1 database and should only be
// used for the agreed cut-over.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { seasonRows, dataRows, toSql, TABLE_ORDER } from '../src/shared/import.js';
import { rowsToGame } from '../src/shared/model.js';
import { calculateStandings } from '../src/shared/scoring.js';
import { legacyAppDataFromSource, legacyStandings, compareStandingsLists } from '../test/reference/legacy-adapter.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const dataPath = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--season');
if (!dataPath) { console.error('Usage: node scripts/load.js <data.json> [--season seed/season-2026.json] [--reset] [--remote]'); process.exit(1); }

const season = JSON.parse(readFileSync(opt('--season', 'seed/season-2026.json'), 'utf8'));
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const base = seasonRows(season);
const { rows, skippedPlayers } = dataRows(data, season.players.map((p) => p.id));
const tables = { ...base, ...rows };

// Parity gate.
const game = rowsToGame({ ...tables, news: [] });
const ours = calculateStandings(game);
const legacy = legacyStandings(season, legacyAppDataFromSource(data), game.seasonFinal);
const diff = compareStandingsLists(legacy, ours);
if (diff) { console.error('PARITY FAILED – nothing was loaded.\n' + diff); process.exit(2); }

console.log(`Parity OK: ${ours.length} players, identical totals, breakdowns and order.`);
for (const s of ours) console.log(`  ${s.playerId.padEnd(10)} ${String(s.totalPoints).padStart(4)} Pkt  (Rennen ${s.racePoints}, Sprint ${s.sprintPoints}, Saison ${s.seasonPoints})`);
console.log(`Rows: ${TABLE_ORDER.map((t) => `${t}=${tables[t].length}`).join(' ')}`);
if (skippedPlayers.length) console.warn(`Skipped tips from players not in the season roster (the old app ignored them too): ${skippedPlayers.join(', ')}`);

const where = flag('--remote') ? '--remote' : '--local';
mkdirSync('.wrangler', { recursive: true });
const sqlFile = '.wrangler/load.sql';
writeFileSync(sqlFile, toSql(tables, { order: TABLE_ORDER }));

const wrangler = (...a) => execFileSync('npx', ['wrangler', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });
if (flag('--reset') && where === '--local') rmSync('.wrangler/state/v3/d1', { recursive: true, force: true });
wrangler('d1', 'migrations', 'apply', 'DB', where);
wrangler('d1', 'execute', 'DB', where, '--file', sqlFile);
console.log(`Loaded into the ${where === '--remote' ? 'REMOTE' : 'local'} database.`);
