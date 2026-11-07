// German formatting helpers.
const TZ = 'Europe/Berlin';

export const flag = (cc) => (cc ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => c.charCodeAt(0) + 127397)) : '');

export const fmtDay = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', timeZone: TZ });
export const fmtWeekdayTime = (iso) => new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });

export function countdownParts(targetIso, now) {
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** "in 2 Tagen", "in 5 Std.", "in 12 Min." */
export function relative(targetIso, now) {
  const p = countdownParts(targetIso, now);
  if (!p) return 'vorbei';
  if (p.d >= 2) return `in ${p.d} Tagen`;
  if (p.d === 1) return `in 1 Tag ${p.h} Std.`;
  if (p.h >= 1) return `in ${p.h} Std. ${p.m} Min.`;
  return `in ${p.m} Min.`;
}

export const pts = (n) => `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`;

export const shortRaceName = (race) => race.name.replace(/^Großer Preis (von |der |des )?/, '').replace(/\s*\(.*\)$/, '');

export const lastName = (driver) => (driver ? driver.name.split(' ').slice(-1)[0] : '–');
