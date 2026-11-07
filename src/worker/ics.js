// Calendar feed: every sprint and race start as an event with a reminder before the tip deadline.
const stamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const fold = (line) => (line.length <= 74 ? line : line.match(/.{1,74}/g).join('\r\n '));

export function buildIcs(races, { origin, now }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kick Tip//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Kick Tip 2026', 'X-WR-TIMEZONE:Europe/Berlin'];
  const dtstamp = stamp(new Date(now).toISOString());
  const event = (uid, startIso, minutes, summary, url) => {
    const end = new Date(new Date(startIso).getTime() + minutes * 60000).toISOString();
    lines.push('BEGIN:VEVENT', `UID:${uid}@kick-tip`, `DTSTAMP:${dtstamp}`, `DTSTART:${stamp(new Date(startIso).toISOString())}`, `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${esc(summary)}`), fold(`DESCRIPTION:${esc(`Tippschluss ist beim Start. Jetzt tippen: ${url}`)}`), fold(`URL:${url}`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(`Noch 2 Stunden: ${summary} tippen!`)}`), 'TRIGGER:-PT2H', 'END:VALARM', 'END:VEVENT');
  };
  for (const r of races) {
    const name = r.name.replace(/^Großer Preis (von |der |des )?/, '').replace(/\s*\(.*\)$/, '');
    const url = `${origin}/rennen/${r.round}`;
    if (r.sprint && r.sprint_start) event(`sprint-${r.round}`, r.sprint_start, 60, `🏁 Sprint ${name}`, url);
    event(`race-${r.round}`, r.race_start, 120, `🏎️ Rennen ${name}`, url);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
