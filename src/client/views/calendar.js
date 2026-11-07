import { html } from '../lib/html.js';
import { flag, fmtDay, shortRaceName, relative } from '../lib/format.js';
import { raceStatus, nextRace } from '../lib/derive.js';
import { Driver } from './parts.js';

export function Calendar({ g, now }) {
  const next = nextRace(g, now);
  return html`<div class="stack">
    <header class="page-head">
      <h1>Rennkalender 2026</h1>
      <p class="muted">${g.races.length} Rennen · ${g.races.filter((r) => r.sprint).length} Sprints · Zeiten in deutscher Zeit</p>
    </header>
    <ol class="calendar">
      ${g.races.map((race) => {
        const status = raceStatus(g, race, now);
        const res = g.raceResults[String(race.round)];
        const isNext = next && next.round === race.round;
        return html`<li class=${`cal-row is-${status} ${isNext ? 'is-next' : ''}`}>
          <span class="cal-round">${race.round}</span>
          <span class="cal-flag" aria-hidden="true">${flag(race.countryCode)}</span>
          <span class="cal-name">
            <b>${shortRaceName(race)}</b>
            <small>${fmtDay(race.raceStartUTC)}${race.sprint ? html` · <span class="badge badge-sprint">Sprint</span>` : ''}</small>
          </span>
          <span class="cal-state">
            ${status === 'done' && html`<span class="winner"><span class="trophy" aria-hidden="true">🏆</span> <${Driver} g=${g} id=${res.winner} /></span>`}
            ${status === 'waiting' && html`<span class="muted small">Ergebnis folgt</span>`}
            ${status === 'open' && isNext && html`<span class="badge badge-live">${relative(race.sprint && race.sprintStartUTC && new Date(race.sprintStartUTC).getTime() > now ? race.sprintStartUTC : race.raceStartUTC, now)}</span>`}
          </span>
        </li>`;
      })}
    </ol>
  </div>`;
}
