// Tip rules shared by server (enforcement) and browser (instant feedback). Messages are German, for players.

/** Deadline of a tip kind for a race: race start, sprint start, or (season) start of round 1. */
export function deadline(kind, race, races) {
  if (kind === 'race') return race.raceStartUTC;
  if (kind === 'sprint') return race.sprint ? race.sprintStartUTC : null;
  if (kind === 'season') return races[0]?.raceStartUTC ?? null;
  return null;
}

export const isOpen = (deadlineIso, now) => !!deadlineIso && now < new Date(deadlineIso).getTime();

function checkPodium(tip, known, errors) {
  const podium = tip.podium || [];
  if (!podium[0] || !podium[1] || !podium[2]) errors.push('Bitte Sieger, P2 und P3 tippen.');
  if (podium.some((d) => d && !known.drivers.has(d))) errors.push('Unbekannter Fahrer im Podium.');
  if (new Set(podium.filter(Boolean)).size !== podium.filter(Boolean).length) errors.push('Ein Fahrer kann nur einmal aufs Podium.');
}

/** Normalise and validate a race tip. Returns { tip, errors }. */
export function validateRaceTip(input, race, known) {
  const errors = [];
  const podium = [input.podium?.[0] || input.winner || '', input.podium?.[1] || '', input.podium?.[2] || ''];
  const tip = {
    winner: podium[0], podium, pole: input.pole || '', fastestLap: input.fastestLap || '', bestConstructor: input.bestConstructor || '',
    dnf: race.dnfDns ? input.dnf || '' : '', dns: race.dnfDns ? input.dns || '' : '',
  };
  checkPodium(tip, known, errors);
  if (!tip.pole) errors.push('Bitte die Pole Position tippen.');
  if (!tip.fastestLap) errors.push('Bitte die schnellste Runde tippen.');
  if (!tip.bestConstructor) errors.push('Bitte den besten Konstrukteur tippen.');
  for (const k of ['pole', 'fastestLap', 'dnf', 'dns']) if (tip[k] && !known.drivers.has(tip[k])) errors.push('Unbekannter Fahrer.');
  if (tip.bestConstructor && !known.teams.has(tip.bestConstructor)) errors.push('Unbekanntes Team.');
  if (tip.dnf && tip.dnf === tip.dns) errors.push('Ein Fahrer kann nicht DNF und DNS zugleich sein.');
  return { tip, errors: [...new Set(errors)] };
}

export function validateSprintTip(input, race, known) {
  const errors = [];
  if (!race.sprint) errors.push('An diesem Wochenende gibt es keinen Sprint.');
  const podium = [input.podium?.[0] || input.winner || '', input.podium?.[1] || '', input.podium?.[2] || ''];
  const tip = { winner: podium[0], podium };
  checkPodium(tip, known, errors);
  return { tip, errors: [...new Set(errors)] };
}

export function validateSeasonTip(input, known) {
  const errors = [];
  const tip = { wdc: input.wdc || '', wcc: input.wcc || '' };
  if (!tip.wdc || !known.drivers.has(tip.wdc)) errors.push('Bitte den Weltmeister tippen.');
  if (!tip.wcc || !known.teams.has(tip.wcc)) errors.push('Bitte den Konstrukteurs-Weltmeister tippen.');
  return { tip, errors };
}
