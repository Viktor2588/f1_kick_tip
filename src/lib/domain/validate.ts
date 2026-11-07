// Input validation for tips and results. Returns either a clean value or a German error message.

import type { DriverId, Podium, RaceResult, RaceTip, Season, SeasonTip, SprintResult, SprintTip, TeamId } from './types';
import { dnfDnsActive } from './schedule';

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function driver(season: Season, v: unknown): DriverId | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' && season.drivers.some((d) => d.id === v) ? v : undefined;
}
function team(season: Season, v: unknown): TeamId | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' && season.teams.some((t) => t.id === v) ? v : undefined;
}

function podium(season: Season, raw: unknown, label: string, full: boolean): Valid<Podium> {
  const arr = Array.isArray(raw) ? raw : [];
  const p = [0, 1, 2].map((i) => driver(season, arr[i]));
  if (p.some((x) => x === undefined)) return fail(`${label}: unbekannter Fahrer`);
  const picked = p.filter(Boolean);
  if (full && picked.length < 3) return fail(`${label}: bitte alle drei Plätze besetzen`);
  if (!p[0]) return fail(`${label}: bitte mindestens den Sieger (P1) wählen`);
  if (new Set(picked).size !== picked.length) return fail(`${label}: jeder Fahrer darf nur einmal vorkommen`);
  return { ok: true, value: p as Podium };
}

export interface RaceTipInput {
  podium?: unknown; pole?: unknown; fastestLap?: unknown; bestConstructor?: unknown; dnf?: unknown; dns?: unknown;
}

export function validateRaceTip(season: Season, round: number, input: RaceTipInput, submittedAt: string): Valid<RaceTip> {
  const pod = podium(season, input.podium, 'Podium', false);
  if (!pod.ok) return pod;
  const pole = driver(season, input.pole);
  const fastestLap = driver(season, input.fastestLap);
  const bestConstructor = team(season, input.bestConstructor);
  let dnf = driver(season, input.dnf);
  let dns = driver(season, input.dns);
  if ([pole, fastestLap, dnf, dns].includes(undefined)) return fail('Unbekannter Fahrer');
  if (bestConstructor === undefined) return fail('Unbekanntes Team');
  if (!dnfDnsActive(season, round)) { dnf = null; dns = null; }
  if (dnf && dnf === dns) return fail('DNF und DNS: ein Fahrer kann nicht beides sein');
  return {
    ok: true,
    value: { podium: pod.value, pole: pole!, fastestLap: fastestLap!, bestConstructor: bestConstructor!, dnf: dnf!, dns: dns!, submittedAt },
  };
}

export function validateSprintTip(season: Season, input: { podium?: unknown }, submittedAt: string): Valid<SprintTip> {
  const pod = podium(season, input.podium, 'Sprint-Podium', false);
  return pod.ok ? { ok: true, value: { podium: pod.value, submittedAt } } : pod;
}

export function validateSeasonTip(season: Season, input: { wdc?: unknown; wcc?: unknown }, submittedAt: string): Valid<SeasonTip> {
  const wdc = driver(season, input.wdc);
  const wcc = team(season, input.wcc);
  if (!wdc) return fail('Bitte einen Weltmeister wählen');
  if (!wcc) return fail('Bitte einen Konstrukteurs-Weltmeister wählen');
  return { ok: true, value: { wdc, wcc, submittedAt } };
}

export interface RaceResultInput extends RaceTipInput {
  dnfList?: unknown; dnsList?: unknown; topTen?: unknown;
}

function driverList(season: Season, v: unknown): DriverId[] | undefined {
  const arr = Array.isArray(v) ? v : [];
  const out = arr.map((x) => driver(season, x));
  if (out.some((x) => x === undefined)) return undefined;
  return [...new Set(out.filter((x): x is string => !!x))];
}

export function validateRaceResult(season: Season, round: number, input: RaceResultInput, enteredAt: string): Valid<RaceResult> {
  const pod = podium(season, input.podium, 'Podium', true);
  if (!pod.ok) return pod;
  const pole = driver(season, input.pole);
  const fastestLap = driver(season, input.fastestLap);
  const bestConstructor = team(season, input.bestConstructor);
  if (!pole) return fail('Bitte Pole Position wählen');
  if (!fastestLap) return fail('Bitte schnellste Runde wählen');
  if (!bestConstructor) return fail('Bitte besten Konstrukteur wählen');
  let dnf: DriverId[] | null = null;
  let dns: DriverId[] | null = null;
  if (dnfDnsActive(season, round)) {
    const a = driverList(season, input.dnfList);
    const b = driverList(season, input.dnsList);
    if (!a || !b) return fail('DNF/DNS: unbekannter Fahrer');
    if (a.some((d) => b.includes(d))) return fail('Ein Fahrer kann nicht DNF und DNS zugleich sein');
    dnf = a;
    dns = b;
  }
  const top = input.topTen === undefined ? [] : driverList(season, input.topTen);
  if (!top) return fail('Top 10: unbekannter Fahrer');
  return {
    ok: true,
    value: { podium: pod.value, pole, fastestLap, bestConstructor, dnf, dns, topTen: top.length ? top : null, enteredAt },
  };
}

export function validateSprintResult(season: Season, input: { podium?: unknown }, enteredAt: string): Valid<SprintResult> {
  const pod = podium(season, input.podium, 'Sprint-Podium', true);
  return pod.ok ? { ok: true, value: { podium: pod.value, enteredAt } } : pod;
}
