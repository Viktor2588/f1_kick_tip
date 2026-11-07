// Builds the "who tipped what" comparison for a weekend, with per-cell hit state and points.

import { POINTS, podiumHits, scoreRace, scoreSprint } from './domain/scoring';
import { dnfDnsActive } from './domain/schedule';
import { isHidden, type Podium, type Visible, type PublicGameData, type Race, type RaceTip, type Season, type SprintTip } from './domain/types';

export type CellState = 'exact' | 'bonus' | 'miss' | 'open' | 'late' | 'none' | 'hidden';

export interface Cell { id: string | null; state: CellState; pts: number }
export interface Row { key: string; label: string; kind: 'driver' | 'team'; cells: Record<string, Cell>; result: string[] | null }
export interface Matrix { rows: Row[]; totals: Record<string, number | null>; anyTips: boolean; revealed: boolean }

function podiumRows(labels: string[], pts: number[], bonus: number, players: string[],
  tips: Record<string, unknown>, result: { podium: (string | null)[] } | null, late: (pid: string) => boolean): Row[] {
  return labels.map((label, i) => {
    const cells: Record<string, Cell> = {};
    for (const pid of players) {
      const t = tips[pid] as Visible<{ podium: Podium }> | undefined;
      if (!t) { cells[pid] = { id: null, state: 'none', pts: 0 }; continue; }
      if (isHidden(t)) { cells[pid] = { id: null, state: 'hidden', pts: 0 }; continue; }
      const id = t.podium[i];
      if (!result) { cells[pid] = { id, state: 'open', pts: 0 }; continue; }
      if (late(pid)) { cells[pid] = { id, state: 'late', pts: 0 }; continue; }
      const h = podiumHits(t.podium, result.podium as Podium)[i];
      cells[pid] = { id, state: h === 'empty' ? 'miss' : h, pts: h === 'exact' ? pts[i] : h === 'bonus' ? bonus : 0 };
    }
    return { key: `p${i + 1}`, label, kind: 'driver', cells, result: result ? [result.podium[i] ?? ''] : null };
  });
}

export function raceMatrix(season: Season, race: Race, game: PublicGameData): Matrix {
  const key = String(race.round);
  const players = season.players.map((p) => p.id);
  const tips = game.raceTips[key] ?? {};
  const result = game.raceResults[key] ?? null;
  const late = (pid: string) => {
    const t = tips[pid];
    return !!t && !isHidden(t) && scoreRace(t, result, race).late;
  };
  const P = POINTS.race;
  const rows = podiumRows(['Sieger', 'Platz 2', 'Platz 3'], [P.winner, P.p2, P.p3], P.podiumBonus, players, tips, result, late);

  const single = (k: 'pole' | 'fastestLap' | 'bestConstructor', label: string, kind: 'driver' | 'team', pts: number): Row => {
    const cells: Record<string, Cell> = {};
    for (const pid of players) {
      const t = tips[pid];
      if (!t) cells[pid] = { id: null, state: 'none', pts: 0 };
      else if (isHidden(t)) cells[pid] = { id: null, state: 'hidden', pts: 0 };
      else if (!result) cells[pid] = { id: t[k], state: 'open', pts: 0 };
      else if (late(pid)) cells[pid] = { id: t[k], state: 'late', pts: 0 };
      else {
        const hit = !!t[k] && t[k] === result[k];
        cells[pid] = { id: t[k], state: hit ? 'exact' : 'miss', pts: hit ? pts : 0 };
      }
    }
    return { key: k, label, kind, cells, result: result ? [result[k] ?? ''] : null };
  };
  rows.push(single('pole', 'Pole', 'driver', P.pole), single('fastestLap', 'Schnellste Runde', 'driver', P.fastestLap),
    single('bestConstructor', 'Konstrukteur', 'team', P.bestConstructor));

  // DNF/DNS only where they count (from rules.dnfFromRound, and only if the result has the lists).
  if (dnfDnsActive(season, race.round) && (!result || Array.isArray(result.dnf))) {
    for (const [k, label, pts] of [['dnf', 'Ausfall (DNF)', P.dnf], ['dns', 'Nicht gestartet (DNS)', P.dns]] as const) {
      const cells: Record<string, Cell> = {};
      for (const pid of players) {
        const t = tips[pid];
        if (!t) cells[pid] = { id: null, state: 'none', pts: 0 };
        else if (isHidden(t)) cells[pid] = { id: null, state: 'hidden', pts: 0 };
        else if (!t[k]) cells[pid] = { id: null, state: result ? 'miss' : 'open', pts: 0 };
        else if (!result) cells[pid] = { id: t[k], state: 'open', pts: 0 };
        else if (late(pid)) cells[pid] = { id: t[k], state: 'late', pts: 0 };
        else {
          const hit = !!result[k]?.includes(t[k]!);
          cells[pid] = { id: t[k], state: hit ? 'exact' : 'miss', pts: hit ? pts : 0 };
        }
      }
      rows.push({ key: k, label, kind: 'driver', cells, result: result ? (result[k] ?? []) : null });
    }
  }

  const totals: Record<string, number | null> = {};
  for (const pid of players) {
    const t = tips[pid];
    totals[pid] = result && t && !isHidden(t) ? scoreRace(t, result, race).total : null;
  }
  return {
    rows, totals,
    anyTips: Object.keys(tips).length > 0,
    revealed: Object.values(tips).every((t) => !isHidden(t)),
  };
}

export function sprintMatrix(season: Season, race: Race, game: PublicGameData): Matrix {
  const key = String(race.round);
  const players = season.players.map((p) => p.id);
  const tips = game.sprintTips[key] ?? {};
  const result = game.sprintResults[key] ?? null;
  const late = (pid: string) => {
    const t = tips[pid];
    return !!t && !isHidden(t) && scoreSprint(t as SprintTip, result, race).late;
  };
  const P = POINTS.sprint;
  const rows = podiumRows(['Sprint-Sieger', 'Platz 2', 'Platz 3'], [P.winner, P.p2, P.p3], P.podiumBonus, players, tips, result, late);
  const totals: Record<string, number | null> = {};
  for (const pid of players) {
    const t = tips[pid];
    totals[pid] = result && t && !isHidden(t) ? scoreSprint(t, result, race).total : null;
  }
  return { rows, totals, anyTips: Object.keys(tips).length > 0, revealed: Object.values(tips).every((t) => !isHidden(t)) };
}
