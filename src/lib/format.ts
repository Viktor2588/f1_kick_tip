export const flag = (cc: string) =>
  cc ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => c.charCodeAt(0) + 127397)) : '';

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', o);
const dayTime = fmt({ weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dayShort = fmt({ day: '2-digit', month: 'short' });
const time = fmt({ hour: '2-digit', minute: '2-digit' });
const weekday = fmt({ weekday: 'long' });

/** "Sa., 07.11., 19:00" */
export const formatDayTime = (iso: string) => dayTime.format(new Date(iso));
/** "08. Nov." */
export const formatDay = (iso: string) => dayShort.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));

/** Human relative deadline: "in 3 Tagen", "morgen 18:00", "heute 18:00", "in 42 Min." */
export function relative(iso: string, now: number): string {
  const at = new Date(iso);
  const diff = at.getTime() - now;
  if (diff <= 0) return 'vorbei';
  if (diff < 3_600_000) return `in ${Math.max(1, Math.round(diff / 60_000))} Min.`;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(at) - startOfDay(new Date(now))) / 86_400_000);
  if (days === 0) return `heute ${time.format(at)}`;
  if (days === 1) return `morgen ${time.format(at)}`;
  if (days < 7) return `${weekday.format(at)} ${time.format(at)}`;
  return `in ${days} Tagen`;
}

export const pad = (n: number) => String(n).padStart(2, '0');

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
