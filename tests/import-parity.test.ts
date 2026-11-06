// End-to-end data parity: legacy data → import into the new database → load → new scoring
// must give the same standings as the legacy app computed from the same data.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as legacy from '../legacy/js/scoring.js';
import { calculateStandings } from '../src/lib/scoring';
import { openDb } from '../src/lib/server/db';
import { importLegacyRows, importSeason, legacyDataToRows, legacyRowsToLegacyData, type LegacyRows } from '../src/lib/server/db/import';
import { demoData, seasonFile, LIVE_EXPORT, ensureSeeded } from '../src/lib/server/db/seed';
import { loadSeason } from '../src/lib/server/season';

function legacyStandings(season: ReturnType<typeof seasonFile>, rows: LegacyRows) {
  const d = legacyRowsToLegacyData(season, rows);
  return legacy.calculateStandings(d.season, d.predictions, d.sprintPredictions, d.results, d.sprintResults, d.seasonPredictions, null);
}

async function newStandings(season: ReturnType<typeof seasonFile>, rows: LegacyRows) {
  const db = await openDb();
  await importSeason(db, season);
  await importLegacyRows(db, season.season, rows);
  const data = await loadSeason(db, season.season);
  return { standings: calculateStandings(data.game), data };
}

describe('import parity (legacy data → new database → standings)', () => {
  it('demo data: identical standings and per-race scores', async () => {
    const demo = demoData();
    const rows = legacyDataToRows(demo);
    const old = legacyStandings(demo.season, rows);
    const { standings } = await newStandings(demo.season, rows);
    expect(standings).toEqual(old);
    expect(standings.some(s => s.totalPoints > 0)).toBe(true);
  });

  it('2026 calendar, teams, drivers and players are imported completely', async () => {
    const season = seasonFile();
    const { data } = await newStandings(season, { race_predictions: [], sprint_predictions: [], season_predictions: [], race_results: [], sprint_results: [] });
    expect(data.races).toHaveLength(season.races.length);
    expect(data.drivers.map(d => d.id)).toEqual(season.drivers.map(d => d.id));
    expect(data.teams).toHaveLength(season.teams.length);
    expect(data.players.map(p => p.id)).toEqual(season.players.map(p => p.id));
    expect(data.drivers.find(d => d.id === 'hirakawa')).toBeTruthy();
    expect(data.races.filter(r => r.sprint).map(r => r.round)).toEqual(season.races.filter(r => r.sprint).map(r => r.round));
  });

  it('raw-row edge cases survive the round trip (nulls, empty DNF lists, dates)', async () => {
    const season = seasonFile();
    const rows: LegacyRows = {
      race_predictions: [
        { round: 16, player_id: 'thomas', winner: 'norris', podium_p1: 'norris', podium_p2: null, podium_p3: 'leclerc', pole: null, fastest_lap: 'norris', best_constructor: 'mclaren', dnf: 'stroll', dns: null, submitted_at: new Date('2026-10-04T08:00:00Z') },
        { round: 16, player_id: 'julia', winner: 'russell', podium_p1: 'russell', podium_p2: 'norris', podium_p3: 'hamilton', pole: 'russell', fastest_lap: null, best_constructor: 'mercedes', dnf: '', dns: 'alonso', submitted_at: '2026-10-04T12:00:00.000Z' },
        { round: 1, player_id: 'viktor', winner: 'russell', podium_p1: 'russell', podium_p2: 'antonelli', podium_p3: 'leclerc', pole: 'russell', fastest_lap: 'verstappen', best_constructor: 'mercedes', dnf: null, dns: null, submitted_at: null },
      ],
      sprint_predictions: [{ round: 2, player_id: 'viktor', winner: 'leclerc', podium_p1: 'leclerc', podium_p2: 'hamilton', podium_p3: 'russell', submitted_at: '2026-03-14T01:00:00Z' }],
      season_predictions: [{ player_id: 'viktor', wdc: 'russell', wcc: 'mclaren', submitted_at: '2026-03-01T10:00:00Z' }],
      race_results: [
        { round: 16, winner: 'verstappen', podium_p1: 'verstappen', podium_p2: 'antonelli', podium_p3: 'hamilton', pole: null, fastest_lap: 'verstappen', best_constructor: 'redbull', top_ten: null, dnf: ['stroll', 'albon'], dns: [], entered_at: '2026-10-05T08:00:00Z' },
        { round: 1, winner: 'russell', podium_p1: 'russell', podium_p2: 'antonelli', podium_p3: 'leclerc', pole: 'russell', fastest_lap: 'verstappen', best_constructor: 'mercedes', top_ten: ['russell'], dnf: null, dns: null, entered_at: '2026-03-09T07:00:00Z' },
      ],
      sprint_results: [{ round: 2, winner: 'russell', podium_p1: 'russell', podium_p2: 'leclerc', podium_p3: 'hamilton', entered_at: null }],
    };
    const old = legacyStandings(season, rows);
    const { standings } = await newStandings(season, rows);
    expect(standings).toEqual(old);
    expect(standings.map(s => s.totalPoints)).toEqual(old.map((s: { totalPoints: number }) => s.totalPoints));
  });

  it('ensureSeeded fills an empty database once', async () => {
    const db = await openDb();
    const first = await ensureSeeded(db);
    expect(['demo', 'live-export']).toContain(first);
    expect(await ensureSeeded(db)).toBe('existing');
  });

  it.skipIf(!existsSync(LIVE_EXPORT))('real 2026 export: identical standings through the new database', async () => {
    const season = seasonFile();
    const rows: LegacyRows = JSON.parse(readFileSync(LIVE_EXPORT, 'utf8'));
    const old = legacyStandings(season, rows);
    const { standings } = await newStandings(season, rows);
    expect(standings).toEqual(old);
  });
});
