// ========================================
// F1 Kick Tip 2026 – Utility Functions
// ========================================

const DATA_BASE = 'data/';

/**
 * Load a JSON file from the data directory.
 */
export async function loadJSON(filename) {
  const resp = await fetch(`${DATA_BASE}${filename}`);
  if (!resp.ok) throw new Error(`Fehler beim Laden von ${filename}: ${resp.status}`);
  return resp.json();
}

/**
 * Load all data files needed for the app.
 */
export async function loadAllData() {
  const [season, predictions, sprintPredictions, seasonPredictions, results, sprintResults] =
    await Promise.all([
      loadJSON('season.json'),
      loadJSON('predictions.json'),
      loadJSON('sprint-predictions.json'),
      loadJSON('season-predictions.json'),
      loadJSON('results.json'),
      loadJSON('sprint-results.json'),
    ]);
  return { season, predictions, sprintPredictions, seasonPredictions, results, sprintResults };
}

/**
 * Find a driver object by ID.
 */
export function getDriver(season, driverId) {
  return season.drivers.find(d => d.id === driverId) || null;
}

/**
 * Get the display name for a driver ID.
 */
export function driverName(season, driverId) {
  const d = getDriver(season, driverId);
  return d ? d.name : driverId;
}

/**
 * Get driver's last name only.
 */
export function driverLastName(season, driverId) {
  const d = getDriver(season, driverId);
  if (!d) return driverId;
  const parts = d.name.split(' ');
  return parts[parts.length - 1];
}

/**
 * Find a team object by ID.
 */
export function getTeam(season, teamId) {
  return season.teams.find(t => t.id === teamId) || null;
}

/**
 * Get team name by ID.
 */
export function teamName(season, teamId) {
  const t = getTeam(season, teamId);
  return t ? t.name : teamId;
}

/**
 * Get team color for a driver ID.
 */
export function teamColorForDriver(season, driverId) {
  const driver = getDriver(season, driverId);
  if (!driver) return '#666';
  const team = getTeam(season, driver.team);
  return team ? team.color : '#666';
}

/**
 * Find a race by round number.
 */
export function getRace(season, round) {
  return season.races.find(r => r.round === round) || null;
}

/**
 * Get the player object by ID.
 */
export function getPlayer(season, playerId) {
  return season.players.find(p => p.id === playerId) || null;
}

/**
 * Country code to flag emoji.
 */
export function countryFlag(countryCode) {
  if (!countryCode) return '';
  const cc = countryCode.toUpperCase();
  const offset = 127397;
  return String.fromCodePoint(...[...cc].map(c => c.charCodeAt(0) + offset));
}

/**
 * Format a date string to German locale.
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Format a date string to a short German format (e.g. "08. Mär").
 */
export function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

/**
 * Format datetime to German locale with time.
 */
export function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Determine the race status: 'upcoming', 'active', or 'finished'.
 * - finished: result exists
 * - active: next unfinished race
 * - upcoming: future races after active
 */
export function getRaceStatus(race, results) {
  const roundStr = String(race.round);
  if (results.results && results.results[roundStr]) return 'finished';
  return 'upcoming';
}

/**
 * Determine the deadline status for a race.
 * Returns 'open', 'locked', or 'finished'.
 */
export function getDeadlineStatus(race, results) {
  const roundStr = String(race.round);
  if (results.results && results.results[roundStr]) return 'finished';
  const now = new Date();
  const deadline = new Date(race.raceStartUTC);
  return now < deadline ? 'open' : 'locked';
}

/**
 * Get sprint deadline status.
 */
export function getSprintDeadlineStatus(race, sprintResults) {
  if (!race.sprint || !race.sprintStartUTC) return null;
  const roundStr = String(race.round);
  if (sprintResults.sprintResults && sprintResults.sprintResults[roundStr]) return 'finished';
  const now = new Date();
  const deadline = new Date(race.sprintStartUTC);
  return now < deadline ? 'open' : 'locked';
}

/**
 * Check if a prediction was submitted late.
 */
export function isLate(submittedAt, deadlineUTC) {
  if (!submittedAt || !deadlineUTC) return false;
  return new Date(submittedAt) > new Date(deadlineUTC);
}

/**
 * Find the next upcoming race (first without a result).
 */
export function getNextRace(season, results) {
  const now = new Date();
  return season.races.find(r => {
    const raceTime = new Date(r.raceStartUTC);
    const roundStr = String(r.round);
    const hasResult = results.results && results.results[roundStr];
    return !hasResult && raceTime > now;
  }) || null;
}

/**
 * Get the number of completed races.
 */
export function completedRaceCount(results) {
  return Object.keys(results.results || {}).length;
}

/**
 * Calculate countdown parts (days, hours, minutes, seconds) from now to target.
 */
export function countdown(targetUTC) {
  const now = new Date();
  const target = new Date(targetUTC);
  const diff = target - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, expired: false };
}

/**
 * Get the last N finished races (most recent first).
 */
export function getRecentRaces(season, results, count = 3) {
  const finishedRounds = Object.keys(results.results || {}).map(Number).sort((a, b) => b - a);
  return finishedRounds.slice(0, count).map(round => getRace(season, round)).filter(Boolean);
}

/**
 * Pad a number to 2 digits.
 */
export function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Get query parameter from URL.
 */
export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
