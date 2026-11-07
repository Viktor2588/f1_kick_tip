// Pulls official results from the Jolpica F1 API (Ergast successor) and maps them to our IDs.
// Used only to pre-fill the admin form; a human always confirms before anything is saved.

import { season } from '$lib/domain/season';
import type { Podium } from '$lib/domain/types';

const API = 'https://api.jolpi.ca/ergast/f1';

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

const TEAM_ALIASES: Record<string, string> = {
  red_bull: 'redbull', rb: 'racingbulls', aston_martin: 'astonmartin', sauber: 'audi', kick_sauber: 'audi',
};

function driverId(d: { familyName: string; driverId: string }): string | null {
  const byName = season.drivers.find((x) => norm(x.name.split(' ').slice(-1)[0]) === norm(d.familyName));
  if (byName) return byName.id;
  return season.drivers.find((x) => d.driverId.endsWith(x.id))?.id ?? null;
}

function teamId(constructorId: string): string | null {
  const id = TEAM_ALIASES[constructorId] ?? constructorId.replace(/_/g, '');
  return season.teams.some((t) => t.id === id) ? id : null;
}

interface ApiResult {
  position: string; positionText: string; points: string; status: string;
  Driver: { driverId: string; familyName: string };
  Constructor: { constructorId: string };
  FastestLap?: { rank?: string };
}

async function get(path: string, fetchFn: typeof fetch, attempt = 0): Promise<Array<Record<string, unknown>>> {
  const res = await fetchFn(`${API}/${season.season}/${path}`, { headers: { accept: 'application/json' } });
  // Jolpica rate-limits bursts (~4 req/s); back off briefly and retry.
  if (res.status === 429 && attempt < 3) {
    await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
    return get(path, fetchFn, attempt + 1);
  }
  if (!res.ok) throw new Error(`Jolpica ${res.status}`);
  return (await res.json()).MRData.RaceTable.Races as Array<Record<string, unknown>>;
}

export interface ImportedRace {
  podium: Podium;
  pole: string | null;
  fastestLap: string | null;
  bestConstructor: string | null;
  dnf: string[];
  dns: string[];
  topTen: string[];
  warnings: string[];
}

/** Best constructor = most points in this race; tie → team with the best single finish. */
export function bestConstructorOf(results: Array<{ team: string | null; points: number; position: number }>): string | null {
  const byTeam = new Map<string, { points: number; best: number }>();
  for (const r of results) {
    if (!r.team) continue;
    const t = byTeam.get(r.team) ?? { points: 0, best: Infinity };
    t.points += r.points;
    t.best = Math.min(t.best, r.position);
    byTeam.set(r.team, t);
  }
  return [...byTeam.entries()].sort((a, b) => b[1].points - a[1].points || a[1].best - b[1].best)[0]?.[0] ?? null;
}

export async function importRace(round: number, fetchFn: typeof fetch = fetch): Promise<ImportedRace | null> {
  const [races, quali] = await Promise.all([get(`${round}/results.json`, fetchFn), get(`${round}/qualifying.json`, fetchFn)]);
  const race = races[0];
  if (!race) return null;
  const rows = race.Results as ApiResult[];
  const warnings: string[] = [];
  const mapped = rows.map((r) => {
    const id = driverId(r.Driver);
    if (!id) warnings.push(`Fahrer unbekannt: ${r.Driver.familyName}`);
    return { r, id, team: teamId(r.Constructor.constructorId), points: Number(r.points), position: Number(r.position) };
  });
  const byPos = (p: number) => mapped.find((m) => m.position === p)?.id ?? null;
  const fastest = mapped.find((m) => m.r.FastestLap?.rank === '1')?.id ?? null;
  if (!fastest) warnings.push('Schnellste Runde nicht in den Daten');
  const qualiRows = (quali[0]?.QualifyingResults as Array<{ position: string; Driver: ApiResult['Driver'] }>) ?? [];
  const poleRow = qualiRows.find((q) => q.position === '1');
  const pole = poleRow ? driverId(poleRow.Driver) : null;
  if (!pole) warnings.push('Pole Position nicht in den Daten');

  // DNS: never took the start. DNF: started, not classified as finisher (retired/accident/…).
  const isDns = (m: (typeof mapped)[number]) => m.r.positionText === 'W' || /did not start|withdrew/i.test(m.r.status);
  const isDnf = (m: (typeof mapped)[number]) => !isDns(m) && m.r.positionText === 'R';
  return {
    podium: [byPos(1), byPos(2), byPos(3)],
    pole,
    fastestLap: fastest,
    bestConstructor: bestConstructorOf(mapped),
    dnf: mapped.filter(isDnf).map((m) => m.id).filter((x): x is string => !!x),
    dns: mapped.filter(isDns).map((m) => m.id).filter((x): x is string => !!x),
    topTen: mapped.filter((m) => m.position <= 10).sort((a, b) => a.position - b.position).map((m) => m.id).filter((x): x is string => !!x),
    warnings,
  };
}

export async function importSprint(round: number, fetchFn: typeof fetch = fetch): Promise<{ podium: Podium } | null> {
  const races = await get(`${round}/sprint.json`, fetchFn);
  const rows = (races[0]?.SprintResults as ApiResult[]) ?? [];
  if (!rows.length) return null;
  const at = (p: string) => {
    const r = rows.find((x) => x.position === p);
    return r ? driverId(r.Driver) : null;
  };
  return { podium: [at('1'), at('2'), at('3')] };
}
