// Result suggestions from the public Jolpica F1 API (Ergast successor). Viktor confirms before anything is saved.
// Mapping is by normalised family name / constructor id; anything unmapped is reported, never guessed.

const API = 'https://api.jolpi.ca/ergast/f1';

const TEAM_IDS = {
  mclaren: 'mclaren', ferrari: 'ferrari', red_bull: 'redbull', mercedes: 'mercedes', aston_martin: 'astonmartin',
  williams: 'williams', rb: 'racingbulls', racing_bulls: 'racingbulls', haas: 'haas', sauber: 'audi', audi: 'audi',
  alpine: 'alpine', cadillac: 'cadillac',
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

function driverMapper(drivers) {
  const byName = new Map();
  for (const d of drivers) {
    byName.set(norm(d.id), d.id);
    byName.set(norm(d.name.split(' ').slice(-1)[0]), d.id);
  }
  return (ergastDriver, unmapped) => {
    const id = byName.get(norm(ergastDriver?.familyName)) || byName.get(norm(ergastDriver?.driverId));
    if (!id && ergastDriver) unmapped.add(`${ergastDriver.givenName} ${ergastDriver.familyName}`);
    return id || '';
  };
}

const DNS = /did not start|withdrew|not classified \(dns\)/i;
const FINISHED = /^(finished|\+\d+ laps?|lapped)$/i;

/** Turn an Ergast race (results + optional qualifying/sprint) into our result shapes. */
export function mapRace(race, { drivers, sprint, qualifying, dnfDns }) {
  const unmapped = new Set();
  const driverId = driverMapper(drivers);
  const results = [...(race?.Results || [])].sort((a, b) => Number(a.position) - Number(b.position));
  const top = results.slice(0, 10).map((r) => driverId(r.Driver, unmapped));

  const teamPoints = new Map();
  const teamBest = new Map();
  for (const r of results) {
    const team = TEAM_IDS[r.Constructor?.constructorId];
    if (!team) { if (r.Constructor) unmapped.add(r.Constructor.name); continue; }
    teamPoints.set(team, (teamPoints.get(team) || 0) + Number(r.points || 0));
    teamBest.set(team, Math.min(teamBest.get(team) ?? 99, Number(r.position)));
  }
  const bestConstructor = [...teamPoints.keys()].sort((a, b) => (teamPoints.get(b) - teamPoints.get(a)) || (teamBest.get(a) - teamBest.get(b)))[0] || '';

  const fl = results.find((r) => r.FastestLap?.rank === '1');
  const poleRow = qualifying?.QualifyingResults?.find((q) => q.position === '1') || results.find((r) => r.grid === '1');

  const out = {
    race: results.length ? {
      podium: top.slice(0, 3), pole: poleRow ? driverId(poleRow.Driver, unmapped) : '', fastestLap: fl ? driverId(fl.Driver, unmapped) : '',
      bestConstructor, topTen: top,
      dnf: dnfDns ? results.filter((r) => !FINISHED.test(r.status) && !DNS.test(r.status)).map((r) => driverId(r.Driver, unmapped)).filter(Boolean) : null,
      dns: dnfDns ? results.filter((r) => DNS.test(r.status)).map((r) => driverId(r.Driver, unmapped)).filter(Boolean) : null,
    } : null,
    sprint: sprint?.SprintResults?.length
      ? { podium: [...sprint.SprintResults].sort((a, b) => Number(a.position) - Number(b.position)).slice(0, 3).map((r) => driverId(r.Driver, unmapped)) }
      : null,
    unmapped: [...unmapped],
  };
  return out;
}

async function getRace(fetchFn, season, round, kind) {
  const res = await fetchFn(`${API}/${season}/${round}/${kind}.json`, { headers: { accept: 'application/json', 'user-agent': 'kick-tip/1.0' } });
  if (!res.ok) throw new Error(`Jolpica ${kind}: HTTP ${res.status}`);
  const data = await res.json();
  return data?.MRData?.RaceTable?.Races?.[0] || null;
}

export async function fetchPrefill({ season, round, drivers, isSprint, dnfDns, fetchFn = fetch }) {
  const [race, qualifying, sprint] = await Promise.all([
    getRace(fetchFn, season, round, 'results'),
    getRace(fetchFn, season, round, 'qualifying').catch(() => null),
    isSprint ? getRace(fetchFn, season, round, 'sprint').catch(() => null) : null,
  ]);
  return mapRace(race, { drivers, sprint, qualifying, dnfDns });
}
