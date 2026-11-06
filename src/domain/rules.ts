// Single source of truth for the points system. Scoring, the tip editor and the
// rules page all read from here, so a rule change is one edit.

export const RACE_POINTS = {
  p1: 3,
  p2: 2,
  p3: 2,
  podiumBonus: 1,
  pole: 3,
  fastestLap: 3,
  bestConstructor: 3,
  perfect: 5,
  dnf: 3,
  dns: 5,
} as const;

export const SPRINT_POINTS = {
  p1: 3,
  p2: 1,
  p3: 1,
  podiumBonus: 1,
  perfect: 2,
} as const;

export const SEASON_POINTS = {
  wdc: 20,
  wcc: 15,
} as const;

/** DNF/DNS tips were introduced mid-season. */
export const DNF_FROM_ROUND = 16;

export type RaceSlot = 'p1' | 'p2' | 'p3' | 'pole' | 'fastestLap' | 'bestConstructor' | 'dnf' | 'dns';
export type SprintSlot = 'p1' | 'p2' | 'p3';

export interface SlotMeta {
  key: RaceSlot;
  label: string;
  short: string;
  kind: 'driver' | 'team';
  optional?: boolean;
  hint: string;
}

export const RACE_SLOTS: SlotMeta[] = [
  { key: 'p1', label: 'Rennsieger', short: 'P1', kind: 'driver', hint: 'Wer gewinnt das Rennen? Zählt gleichzeitig als dein Podium-P1.' },
  { key: 'p2', label: 'Platz 2', short: 'P2', kind: 'driver', hint: 'Wer wird Zweiter?' },
  { key: 'p3', label: 'Platz 3', short: 'P3', kind: 'driver', hint: 'Wer wird Dritter?' },
  { key: 'pole', label: 'Pole Position', short: 'Pole', kind: 'driver', hint: 'Wer steht nach dem Qualifying ganz vorne?' },
  { key: 'fastestLap', label: 'Schnellste Runde', short: 'SR', kind: 'driver', hint: 'Wer fährt im Rennen die schnellste Runde?' },
  { key: 'bestConstructor', label: 'Bester Konstrukteur', short: 'Team', kind: 'team', hint: 'Welches Team holt im Rennen die meisten WM-Punkte? Bei Gleichstand zählt die beste Einzelplatzierung.' },
  { key: 'dnf', label: 'Ausfall (DNF)', short: 'DNF', kind: 'driver', optional: true, hint: 'Ein Fahrer, der startet, aber nicht ins Ziel kommt. Freiwillig.' },
  { key: 'dns', label: 'Nicht gestartet (DNS)', short: 'DNS', kind: 'driver', optional: true, hint: 'Ein Fahrer, der gar nicht erst startet. Freiwillig.' },
];

export const SPRINT_SLOTS: SlotMeta[] = [
  { key: 'p1', label: 'Sprint-Sieger', short: 'P1', kind: 'driver', hint: 'Wer gewinnt den Sprint?' },
  { key: 'p2', label: 'Sprint Platz 2', short: 'P2', kind: 'driver', hint: 'Wer wird im Sprint Zweiter?' },
  { key: 'p3', label: 'Sprint Platz 3', short: 'P3', kind: 'driver', hint: 'Wer wird im Sprint Dritter?' },
];

export const raceSlotsFor = (round: number): SlotMeta[] =>
  RACE_SLOTS.filter((s) => !s.optional || round >= DNF_FROM_ROUND);

export const SLOT_POINTS: Record<RaceSlot, number> = {
  p1: RACE_POINTS.p1,
  p2: RACE_POINTS.p2,
  p3: RACE_POINTS.p3,
  pole: RACE_POINTS.pole,
  fastestLap: RACE_POINTS.fastestLap,
  bestConstructor: RACE_POINTS.bestConstructor,
  dnf: RACE_POINTS.dnf,
  dns: RACE_POINTS.dns,
};

/** Max race points without podium bonus (it never adds to a perfect round). */
export const RACE_MAX_BASE =
  RACE_POINTS.p1 + RACE_POINTS.p2 + RACE_POINTS.p3 + RACE_POINTS.pole +
  RACE_POINTS.fastestLap + RACE_POINTS.bestConstructor + RACE_POINTS.perfect; // 21
export const RACE_MAX_DNF = RACE_POINTS.dnf + RACE_POINTS.dns; // 8
export const SPRINT_MAX = SPRINT_POINTS.p1 + SPRINT_POINTS.p2 + SPRINT_POINTS.p3 + SPRINT_POINTS.perfect; // 7

export const TIEBREAKERS = ['Mehr richtige Sieger-Tipps', 'Mehr perfekte Runden', 'Mehr richtige Pole-Tipps'];
