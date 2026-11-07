import raw from './season.json';
import type { Driver, Player, Race, Season, Team } from './types';

export const season = raw as Season;

const drivers = new Map(season.drivers.map((d) => [d.id, d]));
const teams = new Map(season.teams.map((t) => [t.id, t]));
const players = new Map(season.players.map((p) => [p.id, p]));

export const driverById = (id: string | null | undefined): Driver | undefined => (id ? drivers.get(id) : undefined);
export const teamById = (id: string | null | undefined): Team | undefined => (id ? teams.get(id) : undefined);
export const playerById = (id: string | null | undefined): Player | undefined => (id ? players.get(id) : undefined);
export const raceByRound = (round: number): Race | undefined => season.races.find((r) => r.round === round);

export const lastName = (id: string | null | undefined) => {
  const d = driverById(id);
  return d ? d.name.split(' ').slice(-1)[0] : (id ?? '–');
};
export const teamName = (id: string | null | undefined) => teamById(id)?.name ?? id ?? '–';
export const teamColorOfDriver = (id: string | null | undefined) => teamById(driverById(id)?.team)?.color ?? '#777';
export const teamColor = (id: string | null | undefined) => teamById(id)?.color ?? '#777';

export function flag(countryCode: string): string {
  return String.fromCodePoint(...[...countryCode.toUpperCase()].map((c) => c.charCodeAt(0) + 127397));
}

/** Short German race name, e.g. "Großer Preis von Brasilien" → "Brasilien". */
export const shortName = (race: Race) => race.country;

/** Three-letter code like on the timing screens: VER, NOR, HUL. */
export function code(id: string | null | undefined): string {
  const d = driverById(id);
  if (!d) return '–';
  return d.name.split(' ').slice(-1)[0].normalize('NFD').replace(/\p{Diacritic}/gu, '').slice(0, 3).toUpperCase();
}
