import type { Season } from '../domain/types';

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

/** iCalendar file with one event per tip deadline, each with a reminder 3 hours before. */
export function deadlinesIcs(season: Season, url: string, fromMs: number): string {
  const now = stamp(new Date().toISOString());
  const ev: string[] = [];
  const add = (uid: string, at: string, title: string, desc: string) => {
    if (new Date(at).getTime() < fromMs) return;
    const end = new Date(new Date(at).getTime() + 2 * 3_600_000).toISOString();
    ev.push([
      'BEGIN:VEVENT',
      `UID:${uid}@f1-kick-tip`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(at)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(desc)}`,
      `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Kick Tip: Tipp abgeben!')}`, 'TRIGGER:-PT3H', 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n'));
  };
  for (const r of season.races) {
    const gp = r.name.replace('Großer Preis', 'GP');
    if (r.sprint && r.sprintStartUTC) add(`s${season.season}-${r.round}`, r.sprintStartUTC, `🏎️ Sprint ${r.country} (Tippschluss)`, `Sprint-Tipp für ${gp} bis zum Start abgeben.\n${url}`);
    add(`r${season.season}-${r.round}`, r.raceStartUTC, `🏁 ${gp} (Tippschluss)`, `Renn-Tipp bis zum Start abgeben.\n${url}`);
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//F1 Kick Tip//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:F1 Kick Tip', ...ev, 'END:VCALENDAR'].join('\r\n');
}

export function download(name: string, text: string, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
