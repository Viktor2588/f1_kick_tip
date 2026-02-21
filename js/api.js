// ========================================
// F1 Kick Tip 2026 – Neon Serverless Client
// ========================================

// ── Database Connection (Neon SQL-over-HTTP) ────────────
const NEON_HOST = 'ep-summer-field-akisi0lv.c-3.us-west-2.aws.neon.tech';
const CONNECTION_STRING = 'postgresql://neondb_owner:npg_I5ZK8GWBerMt@ep-summer-field-akisi0lv.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require';

/**
 * Execute a parameterized SQL query via Neon HTTP API.
 * Returns rows as array of objects.
 */
async function query(queryText, params = []) {
  const resp = await fetch(`https://${NEON_HOST}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': CONNECTION_STRING,
    },
    body: JSON.stringify([{ query: queryText, params }]),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`DB-Fehler ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const result = data.results[0];
  if (result.error) throw new Error(result.error.message || 'SQL-Fehler');

  const fields = result.fields.map(f => f.name);
  return result.rows.map(row => {
    const obj = {};
    fields.forEach((name, i) => { obj[name] = row[i]; });
    return obj;
  });
}

/**
 * Execute SQL without returning rows (INSERT/UPDATE/DELETE).
 */
async function execute(queryText, params = []) {
  const resp = await fetch(`https://${NEON_HOST}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': CONNECTION_STRING,
    },
    body: JSON.stringify([{ query: queryText, params }]),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`DB-Fehler ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const result = data.results[0];
  if (result.error) throw new Error(result.error.message || 'SQL-Fehler');
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

export async function fetchPredictions() {
  try {
    const rows = await query('SELECT * FROM race_predictions');
    const predictions = {};

    for (const row of rows) {
      const roundStr = String(row.round);
      if (!predictions[roundStr]) predictions[roundStr] = {};
      predictions[roundStr][row.player_id] = {
        winner: row.winner,
        podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        pole: row.pole,
        fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor,
        submittedAt: row.submitted_at,
      };
    }

    return { predictions };
  } catch (e) {
    console.error('fetchPredictions:', e);
    return { predictions: {} };
  }
}

export async function fetchSprintPredictions() {
  try {
    const rows = await query('SELECT * FROM sprint_predictions');
    const sprintPredictions = {};

    for (const row of rows) {
      const roundStr = String(row.round);
      if (!sprintPredictions[roundStr]) sprintPredictions[roundStr] = {};
      sprintPredictions[roundStr][row.player_id] = {
        winner: row.winner,
        podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        submittedAt: row.submitted_at,
      };
    }

    return { sprintPredictions };
  } catch (e) {
    console.error('fetchSprintPredictions:', e);
    return { sprintPredictions: {} };
  }
}

export async function fetchSeasonPredictions() {
  try {
    const rows = await query('SELECT * FROM season_predictions');
    const seasonPredictions = {};

    for (const row of rows) {
      seasonPredictions[row.player_id] = {
        wdc: row.wdc,
        wcc: row.wcc,
        submittedAt: row.submitted_at,
      };
    }

    return { seasonPredictions };
  } catch (e) {
    console.error('fetchSeasonPredictions:', e);
    return { seasonPredictions: {} };
  }
}

export async function fetchResults() {
  try {
    const rows = await query('SELECT * FROM race_results');
    const results = {};

    for (const row of rows) {
      const roundStr = String(row.round);
      results[roundStr] = {
        winner: row.winner,
        podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        pole: row.pole,
        fastestLap: row.fastest_lap,
        bestConstructor: row.best_constructor,
        topTen: row.top_ten || undefined,
        enteredAt: row.entered_at,
      };
    }

    return { results };
  } catch (e) {
    console.error('fetchResults:', e);
    return { results: {} };
  }
}

export async function fetchSprintResults() {
  try {
    const rows = await query('SELECT * FROM sprint_results');
    const sprintResults = {};

    for (const row of rows) {
      const roundStr = String(row.round);
      sprintResults[roundStr] = {
        winner: row.winner,
        podium: [row.podium_p1, row.podium_p2, row.podium_p3],
        enteredAt: row.entered_at,
      };
    }

    return { sprintResults };
  } catch (e) {
    console.error('fetchSprintResults:', e);
    return { sprintResults: {} };
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
