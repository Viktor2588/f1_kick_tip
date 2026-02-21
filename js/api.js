// ========================================
// F1 Kick Tip 2026 – Neon API Client
// ========================================

// ── Configuration ────────────────────────────────────────
const DATA_API_URL = 'https://ep-summer-field-akisi0lv.apirest.c-3.us-west-2.aws.neon.tech/neondb/rest/v1';

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

// ── Data API Helpers ─────────────────────────────────────

async function apiGet(table, query = '') {
  const resp = await fetch(`${DATA_API_URL}/${table}${query}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `API-Fehler: ${resp.status}`);
  }
  return resp.json();
}

async function apiUpsert(table, data) {
  const headers = {
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
  };

  const resp = await fetch(`${DATA_API_URL}/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `API-Fehler: ${resp.status}`);
  }
  return resp;
}

// ── Read Functions (DB → App Format) ─────────────────────

/**
 * Fetch all race predictions and transform to app format.
 * DB rows → { predictions: { "1": { "thomas": { winner, podium:[], ... } } } }
 */
export async function fetchPredictions() {
  try {
    const rows = await apiGet('race_predictions', '?select=*');
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
  } catch {
    return { predictions: {} };
  }
}

/**
 * Fetch all sprint predictions.
 * DB rows → { sprintPredictions: { "4": { "thomas": { winner, podium:[] } } } }
 */
export async function fetchSprintPredictions() {
  try {
    const rows = await apiGet('sprint_predictions', '?select=*');
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
  } catch {
    return { sprintPredictions: {} };
  }
}

/**
 * Fetch all season predictions.
 * DB rows → { seasonPredictions: { "thomas": { wdc, wcc, submittedAt } } }
 */
export async function fetchSeasonPredictions() {
  try {
    const rows = await apiGet('season_predictions', '?select=*');
    const seasonPredictions = {};

    for (const row of rows) {
      seasonPredictions[row.player_id] = {
        wdc: row.wdc,
        wcc: row.wcc,
        submittedAt: row.submitted_at,
      };
    }

    return { seasonPredictions };
  } catch {
    return { seasonPredictions: {} };
  }
}

/**
 * Fetch all race results.
 * DB rows → { results: { "1": { winner, podium:[], pole, ... } } }
 */
export async function fetchResults() {
  try {
    const rows = await apiGet('race_results', '?select=*');
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
  } catch {
    return { results: {} };
  }
}

/**
 * Fetch all sprint results.
 * DB rows → { sprintResults: { "4": { winner, podium:[] } } }
 */
export async function fetchSprintResults() {
  try {
    const rows = await apiGet('sprint_results', '?select=*');
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
  } catch {
    return { sprintResults: {} };
  }
}

// ── Write Functions (App → DB) ───────────────────────────

/**
 * Submit or update a race prediction.
 */
export async function submitRacePrediction(round, playerId, data) {
  return apiUpsert('race_predictions', {
    round,
    player_id: playerId,
    winner: data.winner,
    podium_p1: data.podium[0] || '',
    podium_p2: data.podium[1] || '',
    podium_p3: data.podium[2] || '',
    pole: data.pole || '',
    fastest_lap: data.fastestLap || '',
    best_constructor: data.bestConstructor || '',
    submitted_at: new Date().toISOString(),
  });
}

/**
 * Submit or update a sprint prediction.
 */
export async function submitSprintPrediction(round, playerId, data) {
  return apiUpsert('sprint_predictions', {
    round,
    player_id: playerId,
    winner: data.winner,
    podium_p1: data.podium[0] || '',
    podium_p2: data.podium[1] || '',
    podium_p3: data.podium[2] || '',
    submitted_at: new Date().toISOString(),
  });
}

/**
 * Submit or update a season prediction.
 */
export async function submitSeasonPrediction(playerId, data) {
  return apiUpsert('season_predictions', {
    player_id: playerId,
    wdc: data.wdc,
    wcc: data.wcc,
    submitted_at: new Date().toISOString(),
  });
}

/**
 * Submit or update a race result (admin).
 */
export async function submitRaceResult(round, data) {
  return apiUpsert('race_results', {
    round,
    winner: data.winner,
    podium_p1: data.podium[0] || '',
    podium_p2: data.podium[1] || '',
    podium_p3: data.podium[2] || '',
    pole: data.pole || '',
    fastest_lap: data.fastestLap || '',
    best_constructor: data.bestConstructor || '',
    top_ten: data.topTen || null,
    entered_at: new Date().toISOString(),
  });
}

/**
 * Submit or update a sprint result (admin).
 */
export async function submitSprintResult(round, data) {
  return apiUpsert('sprint_results', {
    round,
    winner: data.winner,
    podium_p1: data.podium[0] || '',
    podium_p2: data.podium[1] || '',
    podium_p3: data.podium[2] || '',
    entered_at: new Date().toISOString(),
  });
}

/**
 * Delete a race result (admin).
 */
export async function deleteRaceResult(round) {
  const resp = await fetch(`${DATA_API_URL}/race_results?round=eq.${round}`, {
    method: 'DELETE',
  });
  if (!resp.ok) throw new Error('Fehler beim Löschen');
}

/**
 * Delete a sprint result (admin).
 */
export async function deleteSprintResult(round) {
  const resp = await fetch(`${DATA_API_URL}/sprint_results?round=eq.${round}`, {
    method: 'DELETE',
  });
  if (!resp.ok) throw new Error('Fehler beim Löschen');
}
