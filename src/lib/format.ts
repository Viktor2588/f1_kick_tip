const TZ = 'Europe/Berlin';

export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' });
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const fmtDayTime = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { timeZone: TZ, day: '2-digit', month: 'short' });
export const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function countdownParts(targetIso: string, nowMs: number) {
  const diff = Math.max(0, Date.parse(targetIso) - nowMs);
  return {
    done: diff === 0,
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
    totalMs: diff,
  };
}

/** "in 2 Tagen", "in 5 Std.", "in 12 Min." – for compact labels. */
export function relIn(targetIso: string, nowMs: number) {
  const c = countdownParts(targetIso, nowMs);
  if (c.done) return 'jetzt';
  if (c.d >= 2) return `in ${c.d} Tagen`;
  if (c.d === 1) return `in 1 Tag ${c.h} Std.`;
  if (c.h >= 1) return `in ${c.h} Std. ${c.m} Min.`;
  return `in ${c.m} Min.`;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
