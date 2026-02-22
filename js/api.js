// ========================================
// F1 Kick Tip 2026 – Neon Serverless Client
// ========================================

// ── Database Connection (Neon WebSocket) ─────────────────
import { Pool, neonConfig } from 'https://esm.sh/@neondatabase/serverless';

const DATABASE_URL = 'postgresql://neondb_owner:npg_I5ZK8GWBerMt@ep-summer-field-akisi0lv.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require';

// Browser has native WebSocket – no polyfill needed
neonConfig.webSocketConstructor = WebSocket;

let _pool;
function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: DATABASE_URL });
  return _pool;
}

/**
 * Execute a parameterized SQL query via Neon WebSocket.
 * Returns rows as array of objects.
 */
async function query(queryText, params = []) {
  const { rows } = await getPool().query(queryText, params);
  return rows;
}

/**
 * Execute SQL without returning rows (INSERT/UPDATE/DELETE).
 */
async function execute(queryText, params = []) {
  await getPool().query(queryText, params);
}

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
 * Fetch ALL data in a single DB connection.
 * Acquires one client from the pool, runs all 5 queries over the same
 * WebSocket, then releases. Avoids 4 extra cold-start roundtrips.
 */
export async function fetchAllData() {
  const client = await getPool().connect();
  try {
    const [rpRes, spRes, seRes, rrRes, srRes] = await Promise.all([
      client.query('SELECT * FROM race_predictions'),
      client.query('SELECT * FROM sprint_predictions'),
      client.query('SELECT * FROM season_predictions'),
      client.query('SELECT * FROM race_results'),
      client.query('SELECT * FROM sprint_results'),
    ]);

    const predictions = {};
    for (const row of rpRes.rows) {
      const r = String(row.round);
      if (!predictions[r]) predictions[r] = {};
      predictions[r][row.player_id] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        pole: row.pole, fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor, submittedAt: row.submitted_at,
      };
    }

    const sprintPredictions = {};
    for (const row of spRes.rows) {
      const r = String(row.round);
      if (!sprintPredictions[r]) sprintPredictions[r] = {};
      sprintPredictions[r][row.player_id] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        submittedAt: row.submitted_at,
      };
    }

    const seasonPredictions = {};
    for (const row of seRes.rows) {
      seasonPredictions[row.player_id] = {
        wdc: row.wdc, wcc: row.wcc, submittedAt: row.submitted_at,
      };
    }

    const results = {};
    for (const row of rrRes.rows) {
      results[String(row.round)] = {
        winner: row.winner, podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        pole: row.pole, fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor, topTen: row.top_ten || undefined,
        enteredAt: row.entered_at,
      };
    }

    const sprintResults = {};
    for (const row of srRes.rows) {
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
  } finally {
    client.release();
  }
}

// ── Write Functions (App → DB) ───────────────────────────

export async function submitRacePrediction(round, playerId, data) {
  await execute(
    `INSERT INTO race_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (round, player_id) DO UPDATE SET
       winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
       podium_p3 = EXCLUDED.podium_p3, pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap,
       best_constructor = EXCLUDED.best_constructor, submitted_at = EXCLUDED.submitted_at`,
    [round, playerId, data.winner, data.podium[0] || '', data.podium[1] || '', data.podium[2] || '',
     data.pole || '', data.fastestLap || '', data.bestConstructor || '', new Date().toISOString()]
  );
}

export async function submitSprintPrediction(round, playerId, data) {
  await execute(
    `INSERT INTO sprint_predictions (round, player_id, winner, podium_p1, podium_p2, podium_p3, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (round, player_id) DO UPDATE SET
       winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1,
       podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
       submitted_at = EXCLUDED.submitted_at`,
    [round, playerId, data.winner, data.podium[0] || '', data.podium[1] || '', data.podium[2] || '',
     new Date().toISOString()]
  );
}

export async function submitSeasonPrediction(playerId, data) {
  await execute(
    `INSERT INTO season_predictions (player_id, wdc, wcc, submitted_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id) DO UPDATE SET
       wdc = EXCLUDED.wdc, wcc = EXCLUDED.wcc, submitted_at = EXCLUDED.submitted_at`,
    [playerId, data.wdc, data.wcc, new Date().toISOString()]
  );
}

export async function deleteSeasonPrediction(playerId) {
  await execute(`DELETE FROM season_predictions WHERE player_id = $1`, [playerId]);
}

export async function submitRaceResult(round, data) {
  await execute(
    `INSERT INTO race_results (round, winner, podium_p1, podium_p2, podium_p3, pole, fastest_lap, best_constructor, top_ten, entered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (round) DO UPDATE SET
       winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1, podium_p2 = EXCLUDED.podium_p2,
       podium_p3 = EXCLUDED.podium_p3, pole = EXCLUDED.pole, fastest_lap = EXCLUDED.fastest_lap,
       best_constructor = EXCLUDED.best_constructor, top_ten = EXCLUDED.top_ten, entered_at = EXCLUDED.entered_at`,
    [round, data.winner, data.podium[0] || '', data.podium[1] || '', data.podium[2] || '',
     data.pole || '', data.fastestLap || '', data.bestConstructor || '', data.topTen || null,
     new Date().toISOString()]
  );
}

export async function submitSprintResult(round, data) {
  await execute(
    `INSERT INTO sprint_results (round, winner, podium_p1, podium_p2, podium_p3, entered_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (round) DO UPDATE SET
       winner = EXCLUDED.winner, podium_p1 = EXCLUDED.podium_p1,
       podium_p2 = EXCLUDED.podium_p2, podium_p3 = EXCLUDED.podium_p3,
       entered_at = EXCLUDED.entered_at`,
    [round, data.winner, data.podium[0] || '', data.podium[1] || '', data.podium[2] || '',
     new Date().toISOString()]
  );
}

export async function deleteRaceResult(round) {
  await execute('DELETE FROM race_results WHERE round = $1', [round]);
}

export async function deleteSprintResult(round) {
  await execute('DELETE FROM sprint_results WHERE round = $1', [round]);
}
