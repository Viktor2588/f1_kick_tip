// ========================================
// F1 Kick Tip 2026 – Neon API Client
// ========================================

// ── Configuration ────────────────────────────────────────
const AUTH_URL = 'https://ep-summer-field-akisi0lv.neonauth.c-3.us-west-2.aws.neon.tech/neondb/auth';
const DATA_API_URL = 'https://ep-summer-field-akisi0lv.apirest.c-3.us-west-2.aws.neon.tech/neondb/rest/v1';
const ALLOWED_ORIGINS = ['https://viktor2588.github.io', 'http://localhost:8080', 'http://127.0.0.1:8080'];

function getOrigin() {
  return window.location.origin;
}

// ── JWT Token Management ─────────────────────────────────
let cachedJwt = null;
let jwtExpiry = 0;

function setJwt(token) {
  cachedJwt = token;
  // JWT expires in ~15min, refresh 1min early
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    jwtExpiry = (payload.exp - 60) * 1000;
  } catch {
    jwtExpiry = Date.now() + 14 * 60 * 1000;
  }
  localStorage.setItem('f1_jwt', token);
  localStorage.setItem('f1_jwt_expiry', String(jwtExpiry));
}

function getJwt() {
  if (cachedJwt && Date.now() < jwtExpiry) return cachedJwt;
  const stored = localStorage.getItem('f1_jwt');
  const storedExpiry = parseInt(localStorage.getItem('f1_jwt_expiry') || '0', 10);
  if (stored && Date.now() < storedExpiry) {
    cachedJwt = stored;
    jwtExpiry = storedExpiry;
    return stored;
  }
  return null;
}

function clearJwt() {
  cachedJwt = null;
  jwtExpiry = 0;
  localStorage.removeItem('f1_jwt');
  localStorage.removeItem('f1_jwt_expiry');
}

// ── Session / Auth State ─────────────────────────────────
let currentSession = null;
let currentPlayerId = null;

export function isLoggedIn() {
  return !!getJwt() && !!currentSession;
}

export function getPlayerIdFromSession() {
  return currentPlayerId;
}

export function getSessionUser() {
  return currentSession?.user || null;
}

// ── Auth Functions ───────────────────────────────────────

/**
 * Sign in with email and password.
 * Returns { session, user } or throws on error.
 */
export async function signIn(email, password) {
  const resp = await fetch(`${AUTH_URL}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || 'Anmeldung fehlgeschlagen');
  }

  const data = await resp.json();

  // After sign-in, fetch session to get JWT
  await refreshSession();

  return data;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  try {
    await fetch(`${AUTH_URL}/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch { /* ignore */ }
  clearJwt();
  currentSession = null;
  currentPlayerId = null;
  localStorage.removeItem('f1_session');
  localStorage.removeItem('f1_player_id');
}

/**
 * Refresh the session and JWT token.
 * Called on page load and when JWT is about to expire.
 */
export async function refreshSession() {
  try {
    const resp = await fetch(`${AUTH_URL}/get-session`, {
      credentials: 'include',
    });

    if (!resp.ok) {
      clearJwt();
      currentSession = null;
      currentPlayerId = null;
      return null;
    }

    // Extract JWT from response header
    const jwt = resp.headers.get('set-auth-jwt');
    if (jwt) {
      setJwt(jwt);
    }

    const session = await resp.json();
    if (!session || !session.user) {
      clearJwt();
      currentSession = null;
      currentPlayerId = null;
      return null;
    }

    currentSession = session;
    localStorage.setItem('f1_session', JSON.stringify(session));

    // Resolve player ID from player_profiles table
    await resolvePlayerId(session.user.id);

    return session;
  } catch {
    // Offline or error: use cached session
    const cached = localStorage.getItem('f1_session');
    if (cached) {
      try {
        currentSession = JSON.parse(cached);
        currentPlayerId = localStorage.getItem('f1_player_id');
      } catch { /* ignore */ }
    }
    return currentSession;
  }
}

/**
 * Initialize auth state on page load.
 */
export async function initAuth() {
  // Try to restore from cache first for instant UI
  const cached = localStorage.getItem('f1_session');
  if (cached) {
    try {
      currentSession = JSON.parse(cached);
      currentPlayerId = localStorage.getItem('f1_player_id');
    } catch { /* ignore */ }
  }

  // Then refresh in background
  await refreshSession();

  // Set up auto-refresh (every 12 minutes)
  setInterval(() => {
    if (isLoggedIn()) refreshSession();
  }, 12 * 60 * 1000);
}

/**
 * Resolve auth_user_id → player_id via player_profiles table.
 */
async function resolvePlayerId(authUserId) {
  const jwt = getJwt();
  if (!jwt) return;

  try {
    const resp = await fetch(
      `${DATA_API_URL}/player_profiles?auth_user_id=eq.${authUserId}&select=player_id`,
      { headers: { 'Authorization': `Bearer ${jwt}` } }
    );
    if (resp.ok) {
      const rows = await resp.json();
      if (rows.length > 0) {
        currentPlayerId = rows[0].player_id;
        localStorage.setItem('f1_player_id', currentPlayerId);
      }
    }
  } catch {
    // Use cached player ID
    currentPlayerId = localStorage.getItem('f1_player_id');
  }
}

// ── Data API Helpers ─────────────────────────────────────

async function apiGet(table, query = '') {
  const jwt = getJwt();
  const headers = {};
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  const resp = await fetch(`${DATA_API_URL}/${table}${query}`, { headers });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `API-Fehler: ${resp.status}`);
  }
  return resp.json();
}

async function apiUpsert(table, data, onConflict) {
  const jwt = getJwt();
  if (!jwt) throw new Error('Nicht angemeldet');

  const headers = {
    'Authorization': `Bearer ${jwt}`,
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
  const jwt = getJwt();
  if (!jwt) throw new Error('Nicht angemeldet');

  const resp = await fetch(`${DATA_API_URL}/race_results?round=eq.${round}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${jwt}` },
  });
  if (!resp.ok) throw new Error('Fehler beim Löschen');
}

/**
 * Delete a sprint result (admin).
 */
export async function deleteSprintResult(round) {
  const jwt = getJwt();
  if (!jwt) throw new Error('Nicht angemeldet');

  const resp = await fetch(`${DATA_API_URL}/sprint_results?round=eq.${round}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${jwt}` },
  });
  if (!resp.ok) throw new Error('Fehler beim Löschen');
}
