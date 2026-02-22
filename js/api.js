// ========================================
// F1 Kick Tip 2026 – Neon Serverless Client
// ========================================

// ── Database Connection (Neon HTTP) ──────────────────────
import { neon } from 'https://esm.sh/@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_I5ZK8GWBerMt@ep-summer-field-akisi0lv.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);

// ── Player Identity (localStorage-based, like when2meet) ─

export function setCurrentPlayer(name) {
  localStorage.setItem('f1_player', name);
}

export function getCurrentPlayer() {
  return localStorage.getItem('f1_player');
}

export function clearCurrentPlayer() {
  localStorage.removeItem('f1_player');
}

export function isLoggedIn() {
  return !!getCurrentPlayer();
}

/** Alias for backward compatibility with renderer.js */
export function getPlayerIdFromSession() {
  return getCurrentPlayer();
}

// ── Read Functions (DB → App Format) ─────────────────────

/**
 * Fetch ALL data in a single HTTP transaction batch.
 * neon().transaction() sends all queries in one HTTP POST request.
 */
export async function fetchAllData() {
  try {
    const [rpRows, spRows, seRows, rrRows, srRows] = await sql.transaction([
      sql`SELECT * FROM race_predictions`,
      sql`SELECT * FROM sprint_predictions`,
      sql`SELECT * FROM season_predictions`,
      sql`SELECT * FROM race_results`,
      sql`SELECT * FROM sprint_results`,
    ]);

    const predictions = {};
    for (const row of rpRows) {
      const r = String(row.round);
      if (!predictions[r]) predictions[r] = {};
      predictions[r][row.player_id] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        pole: row.pole, fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor, submittedAt: row.submitted_at,
      };
    }

    const sprintPredictions = {};
    for (const row of spRows) {
      const r = String(row.round);
      if (!sprintPredictions[r]) sprintPredictions[r] = {};
      sprintPredictions[r][row.player_id] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        submittedAt: row.submitted_at,
      };
    }

    const seasonPredictions = {};
    for (const row of seRows) {
      seasonPredictions[row.player_id] = {
        wdc: row.wdc, wcc: row.wcc, submittedAt: row.submitted_at,
      };
    }

    const results = {};
    for (const row of rrRows) {
      results[String(row.round)] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        pole: row.pole, fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor, topTen: row.top_ten || undefined,
        enteredAt: row.entered_at,
      };
    }

    const sprintResults = {};
    for (const row of srRows) {
      sprintResults[String(row.round)] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        enteredAt: row.entered_at,
      };
    }

    return {
      predictions: { predictions },
      sprintPredictions: { sprintPredictions },
      seasonPredictions: { seasonPredictions },
      results: { results },
      sprintResults: { sprintResults },
    };
  } catch (e) {
    console.error('fetchAllData:', e);
    return {
      predictions: { predictions: {} },
      sprintPredictions: { sprintPredictions: {} },
      seasonPredictions: { seasonPredictions: {} },
      results: { results: {} },
      sprintResults: { sprintResults: {} },
    };
  }
}

// ── Write Functions (App → DB) ───────────────────────────

export async function submitRacePrediction(round, playerId, data) {
  const now = new Date().toISOString();
  await sql`INSERT INTO race_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, submitted_at)
    VALUES (${round}, ${playerId}, ${data.winner}, ${data.podium[0] || ''}, ${data.podium[1] || ''}, ${data.podium[2] || ''},
            ${data.pole || ''}, ${data.fastestLap || ''}, ${data.bestConstructor || ''}, ${now})
    ON CONFLICT (round, player_id) DO UPDATE SET
      winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
      podium_p3 = EXCLUDED.podium_p3, pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap,
      best_constructor = EXCLUDED.best_constructor, submitted_at = EXCLUDED.submitted_at`;
}

export async function submitSprintPrediction(round, playerId, data) {
  const now = new Date().toISOString();
  await sql`INSERT INTO sprint_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, submitted_at)
    VALUES (${round}, ${playerId}, ${data.winner}, ${data.podium[0] || ''}, ${data.podium[1] || ''}, ${data.podium[2] || ''}, ${now})
    ON CONFLICT (round, player_id) DO UPDATE SET
      winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1,
      podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
      submitted_at = EXCLUDED.submitted_at`;
}

export async function submitSeasonPrediction(playerId, data) {
  const now = new Date().toISOString();
  await sql`INSERT INTO season_predictions (player_id, wdc, wcc, submitted_at)
    VALUES (${playerId}, ${data.wdc}, ${data.wcc}, ${now})
    ON CONFLICT (player_id) DO UPDATE SET
      wdc = EXCLUDED.wdc, wcc = EXCLUDED.wcc, submitted_at = EXCLUDED.submitted_at`;
}

export async function deleteSeasonPrediction(playerId) {
  await sql`DELETE FROM season_predictions WHERE player_id = ${playerId}`;
}

export async function submitRaceResult(round, data) {
  const now = new Date().toISOString();
  await sql`INSERT INTO race_results (round, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, top_ten, entered_at)
    VALUES (${round}, ${data.winner}, ${data.podium[0] || ''}, ${data.podium[1] || ''}, ${data.podium[2] || ''},
            ${data.pole || ''}, ${data.fastestLap || ''}, ${data.bestConstructor || ''}, ${data.topTen || null}, ${now})
    ON CONFLICT (round) DO UPDATE SET
      winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
      podium_p3 = EXCLUDED.podium_p3, pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap,
      best_constructor = EXCLUDED.best_constructor, top_ten = EXCLUDED.top_ten, entered_at = EXCLUDED.entered_at`;
}

export async function submitSprintResult(round, data) {
  const now = new Date().toISOString();
  await sql`INSERT INTO sprint_results (round, winner, podium_p1, podium_p2, podium_p3, entered_at)
    VALUES (${round}, ${data.winner}, ${data.podium[0] || ''}, ${data.podium[1] || ''}, ${data.podium[2] || ''}, ${now})
    ON CONFLICT (round) DO UPDATE SET
      winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1,
      podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
      entered_at = EXCLUDED.entered_at`;
}

export async function deleteRaceResult(round) {
  await sql`DELETE FROM race_results WHERE round = ${round}`;
}

export async function deleteSprintResult(round) {
  await sql`DELETE FROM sprint_results WHERE round = ${round}`;
}
