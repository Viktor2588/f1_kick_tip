// Imports the legacy app's data into the rebuild's database.
//
// Two inputs are supported:
// - LegacyData: the JSON-file shape (season.json + predictions/results files, e.g. legacy/data/test)
// - LegacyRows: raw rows of the five legacy tables, as `SELECT *` returns them (the live export)
import type { Db } from './index';
import * as t from './schema';
import type { LegacyData, LegacySeasonFile } from '$lib/legacy-format';

export interface LegacyRows {
  race_predictions: Record<string, unknown>[];
  sprint_predictions: Record<string, unknown>[];
  season_predictions: Record<string, unknown>[];
  race_results: Record<string, unknown>[];
  sprint_results: Record<string, unknown>[];
}

const s = (v: unknown): string | null => (v === undefined || v === null ? null : v instanceof Date ? v.toISOString() : String(v));
const arr = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);

export async function importSeason(db: Db, season: LegacySeasonFile) {
  const year = season.season;
  await db.insert(t.seasons).values({ year }).onConflictDoNothing();
  await db.insert(t.teams).values(season.teams.map(x => ({ season: year, id: x.id, name: x.name, color: x.color }))).onConflictDoNothing();
  await db.insert(t.drivers).values(season.drivers.map((d, i) => ({ season: year, id: d.id, name: d.name, number: d.number, teamId: d.team, sortOrder: i }))).onConflictDoNothing();
  await db.insert(t.races).values(season.races.map(r => ({
    season: year, round: r.round, name: r.name, country: r.country, countryCode: r.countryCode, circuit: r.circuit, city: r.city,
    date: r.date, qualiStart: r.qualiStartUTC ?? null, sprintStart: r.sprintStartUTC ?? null, raceStart: r.raceStartUTC, sprint: !!r.sprint,
  }))).onConflictDoNothing();
  await db.insert(t.players).values(season.players.map((p, i) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, sortOrder: i }))).onConflictDoNothing();
}

/** Raw legacy table rows (live export) → new tables. Column values are kept as they are. */
export async function importLegacyRows(db: Db, year: number, rows: LegacyRows) {
  const rt = rows.race_predictions.map(r => ({
    season: year, round: Number(r.round), playerId: String(r.player_id), winner: s(r.winner),
    podiumP1: s(r.podium_p1), podiumP2: s(r.podium_p2), podiumP3: s(r.podium_p3), pole: s(r.pole), fastestLap: s(r.fastest_lap),
    bestConstructor: s(r.best_constructor), dnf: s(r.dnf), dns: s(r.dns), submittedAt: s(r.submitted_at),
  }));
  const st = rows.sprint_predictions.map(r => ({
    season: year, round: Number(r.round), playerId: String(r.player_id), winner: s(r.winner),
    podiumP1: s(r.podium_p1), podiumP2: s(r.podium_p2), podiumP3: s(r.podium_p3), submittedAt: s(r.submitted_at),
  }));
  const se = rows.season_predictions.map(r => ({ season: year, playerId: String(r.player_id), wdc: s(r.wdc), wcc: s(r.wcc), submittedAt: s(r.submitted_at) }));
  const rr = rows.race_results.map(r => ({
    season: year, round: Number(r.round), winner: s(r.winner), podiumP1: s(r.podium_p1), podiumP2: s(r.podium_p2), podiumP3: s(r.podium_p3),
    pole: s(r.pole), fastestLap: s(r.fastest_lap), bestConstructor: s(r.best_constructor),
    topTen: arr(r.top_ten), dnf: arr(r.dnf), dns: arr(r.dns), enteredAt: s(r.entered_at),
  }));
  const sr = rows.sprint_results.map(r => ({
    season: year, round: Number(r.round), winner: s(r.winner), podiumP1: s(r.podium_p1), podiumP2: s(r.podium_p2), podiumP3: s(r.podium_p3), enteredAt: s(r.entered_at),
  }));
  if (rt.length) await db.insert(t.raceTips).values(rt).onConflictDoNothing();
  if (st.length) await db.insert(t.sprintTips).values(st).onConflictDoNothing();
  if (se.length) await db.insert(t.seasonTips).values(se).onConflictDoNothing();
  if (rr.length) await db.insert(t.raceResults).values(rr).onConflictDoNothing();
  if (sr.length) await db.insert(t.sprintResults).values(sr).onConflictDoNothing();
}

/** JSON-file shape → the same raw rows the legacy database would hold, then imported. */
export function legacyDataToRows(data: LegacyData): LegacyRows {
  const rows: LegacyRows = { race_predictions: [], sprint_predictions: [], season_predictions: [], race_results: [], sprint_results: [] };
  for (const [round, byPlayer] of Object.entries(data.predictions.predictions ?? {}))
    for (const [player_id, p] of Object.entries(byPlayer))
      rows.race_predictions.push({ round, player_id, winner: p.winner, podium_p1: p.podium?.[0], podium_p2: p.podium?.[1], podium_p3: p.podium?.[2],
        pole: p.pole, fastest_lap: p.fastestLap, best_constructor: p.bestConstructor, dnf: p.dnf, dns: p.dns, submitted_at: p.submittedAt });
  for (const [round, byPlayer] of Object.entries(data.sprintPredictions.sprintPredictions ?? {}))
    for (const [player_id, p] of Object.entries(byPlayer))
      rows.sprint_predictions.push({ round, player_id, winner: p.winner, podium_p1: p.podium?.[0], podium_p2: p.podium?.[1], podium_p3: p.podium?.[2], submitted_at: p.submittedAt });
  for (const [player_id, p] of Object.entries(data.seasonPredictions.seasonPredictions ?? {}))
    rows.season_predictions.push({ player_id, wdc: p.wdc, wcc: p.wcc, submitted_at: p.submittedAt });
  for (const [round, r] of Object.entries(data.results.results ?? {}))
    rows.race_results.push({ round, winner: r.winner, podium_p1: r.podium?.[0], podium_p2: r.podium?.[1], podium_p3: r.podium?.[2],
      pole: r.pole, fastest_lap: r.fastestLap, best_constructor: r.bestConstructor, top_ten: (r as { topTen?: string[] }).topTen, dnf: r.dnf, dns: r.dns,
      entered_at: (r as { enteredAt?: string }).enteredAt });
  for (const [round, r] of Object.entries(data.sprintResults.sprintResults ?? {}))
    rows.sprint_results.push({ round, winner: r.winner, podium_p1: r.podium?.[0], podium_p2: r.podium?.[1], podium_p3: r.podium?.[2], entered_at: (r as { enteredAt?: string }).enteredAt });
  return rows;
}

/**
 * Exactly what legacy fetchAllData() did with the raw rows (legacy/js/api.js before removal),
 * so the parity test can feed the old scoring the same objects the old app did.
 */
export function legacyRowsToLegacyData(season: LegacySeasonFile, rows: LegacyRows): LegacyData {
  type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const predictions: Record<string, Record<string, unknown>> = {};
  for (const row of rows.race_predictions as R[]) {
    const r = String(row.round);
    (predictions[r] ??= {})[row.player_id] = {
      winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
      pole: row.pole, fastestLap: row.fastest_lap, bestConstructor: row.best_constructor, dnf: row.dnf, dns: row.dns,
      submittedAt: row.submitted_at,
    };
  }
  const sprintPredictions: Record<string, Record<string, unknown>> = {};
  for (const row of rows.sprint_predictions as R[]) {
    (sprintPredictions[String(row.round)] ??= {})[row.player_id] = { winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], submittedAt: row.submitted_at };
  }
  const seasonPredictions: Record<string, unknown> = {};
  for (const row of rows.season_predictions as R[]) seasonPredictions[row.player_id] = { wdc: row.wdc, wcc: row.wcc, submittedAt: row.submitted_at };
  const results: Record<string, unknown> = {};
  for (const row of rows.race_results as R[]) {
    results[String(row.round)] = {
      winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], pole: row.pole, fastestLap: row.fastest_lap,
      bestConstructor: row.best_constructor, topTen: row.top_ten || undefined, dnf: row.dnf || undefined, dns: row.dns || undefined, enteredAt: row.entered_at,
    };
  }
  const sprintResults: Record<string, unknown> = {};
  for (const row of rows.sprint_results as R[]) sprintResults[String(row.round)] = { winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], enteredAt: row.entered_at };
  return {
    season,
    predictions: { predictions } as LegacyData['predictions'],
    sprintPredictions: { sprintPredictions } as LegacyData['sprintPredictions'],
    seasonPredictions: { seasonPredictions } as LegacyData['seasonPredictions'],
    results: { results } as LegacyData['results'],
    sprintResults: { sprintResults } as LegacyData['sprintResults'],
  };
}
