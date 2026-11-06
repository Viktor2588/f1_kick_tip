import type { Race } from './types';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Folds lines longer than 75 octets as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** Calendar with one event per tip deadline (race start, sprint start), reminder 2 h before. */
export function tipDeadlineCalendar(races: Race[], year: number, baseUrl: string, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//F1 Kick Tip//Tipp-Deadlines//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:F1 Kick Tip ${year} · Tipp-Schluss`, 'X-WR-TIMEZONE:Europe/Berlin', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
  ];
  const event = (uid: string, startUTC: string, minutes: number, summary: string, description: string, url: string) => {
    const start = new Date(startUTC);
    lines.push(
      'BEGIN:VEVENT', `UID:${uid}@f1-kick-tip`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(start.getTime() + minutes * 60_000))}`, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(description)}`, `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT2H', `DESCRIPTION:${esc('In 2 Stunden ist Tipp-Schluss: ' + summary)}`, 'END:VALARM',
      'END:VEVENT',
    );
  };
  for (const r of races) {
    const url = `${baseUrl}/rennen/${r.round}`;
    if (r.sprint && r.sprintStartUTC) {
      event(`${year}-${r.round}-sprint`, r.sprintStartUTC, 30, `🏁 Sprint-Tipp-Schluss · ${r.country}`, `Sprint-Tipps bis zum Sprint-Start. ${url}`, url);
    }
    event(`${year}-${r.round}-race`, r.raceStartUTC, 120, `🏎️ Tipp-Schluss · ${r.name}`, `Renntipps bis zum Rennstart (Runde ${r.round}). ${url}`, url);
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
