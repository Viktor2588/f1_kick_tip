// Runs the ORIGINAL 2026 scoring code on the ORIGINAL data shapes, independent of the new import path.
// Used by the parity tests and by scripts/load.js as a gate before loading data.

import { calculateStandings as legacyCalculateStandings } from './legacy-scoring.js';

const unwrap = (v, key) => (v && typeof v === 'object' && !Array.isArray(v) && key in v ? v[key] : v) || {};

/**
 * Turn source data into the shapes the old app passed to calculateStandings.
 * Raw table rows are mapped exactly like js/api.js fetchAllData() did on main.
 */
export function legacyAppDataFromSource(data) {
  if (Array.isArray(data.race_predictions) || Array.isArray(data.race_results)) {
    const predictions = {}, sprintPredictions = {}, seasonPredictions = {}, results = {}, sprintResults = {};
    for (const row of data.race_predictions || []) {
      (predictions[String(row.round)] ??= {})[row.player_id] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], pole: row.pole, fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor, dnf: row.dnf, dns: row.dns, submittedAt: row.submitted_at,
      };
    }
    for (const row of data.sprint_predictions || []) {
      (sprintPredictions[String(row.round)] ??= {})[row.player_id] = { winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], submittedAt: row.submitted_at };
    }
    for (const row of data.season_predictions || []) seasonPredictions[row.player_id] = { wdc: row.wdc, wcc: row.wcc, submittedAt: row.submitted_at };
    for (const row of data.race_results || []) {
      results[String(row.round)] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], pole: row.pole, fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor, topTen: row.top_ten || undefined, dnf: row.dnf || undefined, dns: row.dns || undefined, enteredAt: row.entered_at,
      };
    }
    for (const row of data.sprint_results || []) sprintResults[String(row.round)] = { winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3], enteredAt: row.entered_at };
    return { predictions, sprintPredictions, seasonPredictions, results, sprintResults };
  }
  return {
    predictions: unwrap(data.predictions, 'predictions'),
    sprintPredictions: unwrap(data.sprintPredictions, 'sprintPredictions'),
    seasonPredictions: unwrap(data.seasonPredictions, 'seasonPredictions'),
    results: unwrap(data.results, 'results'),
    sprintResults: unwrap(data.sprintResults, 'sprintResults'),
  };
}

export function legacyStandings(season, app, finalStandings = null) {
  return legacyCalculateStandings(
    season,
    { predictions: app.predictions },
    { sprintPredictions: app.sprintPredictions },
    { results: app.results },
    { sprintResults: app.sprintResults },
    { seasonPredictions: app.seasonPredictions },
    finalStandings,
  );
}

/** Compare two standings lists; returns null when identical, otherwise a readable description of the first difference. */
export function compareStandingsLists(legacy, ours) {
  if (legacy.length !== ours.length) return `player count differs: legacy ${legacy.length}, new ${ours.length}`;
  for (let i = 0; i < legacy.length; i++) {
    const a = legacy[i], b = ours[i];
    for (const k of ['playerId', 'totalPoints', 'racePoints', 'sprintPoints', 'seasonPoints', 'correctWinners', 'perfectRounds', 'correctPoles']) {
      if (a[k] !== b[k]) return `position ${i + 1}: ${k} legacy=${a[k]} new=${b[k]}`;
    }
    for (const [kind, la, lb] of [['race', a.raceScores, b.raceScores], ['sprint', a.sprintScores, b.sprintScores]]) {
      const rounds = new Set([...Object.keys(la), ...Object.keys(lb)]);
      for (const r of rounds) {
        const x = JSON.stringify(la[r]), y = JSON.stringify(lb[r]);
        if (x !== y) return `${a.playerId} ${kind} round ${r}: legacy=${x} new=${y}`;
      }
    }
  }
  return null;
}
