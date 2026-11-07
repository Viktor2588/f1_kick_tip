import { html } from '../lib/html.js';
import { Link } from '../lib/router.js';
import { flag, fmtWeekdayTime, countdownParts, shortRaceName, fmtDay } from '../lib/format.js';
import { nextRace, openSessions, standingsWithHistory, finishedRounds } from '../lib/derive.js';
import { Player, Driver, Move } from './parts.js';

function Countdown({ target, now }) {
  const p = countdownParts(target, now);
  if (!p) return html`<div class="countdown done">Tippschluss erreicht</div>`;
  const cell = (v, l) => html`<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`;
  return html`<div class="countdown" role="timer" aria-label="Zeit bis Tippschluss">
    ${p.d > 0 && cell(p.d, p.d === 1 ? 'Tag' : 'Tage')}${cell(p.h, 'Std')}${cell(p.m, 'Min')}${cell(p.s, 'Sek')}
  </div>`;
}

function NextRace({ g, me, now }) {
  const race = nextRace(g, now);
  if (!race) return html`<section class="card hero"><h2>Saison beendet</h2><p class="muted">Alle Rennen sind gefahren. Danke fürs Mittippen!</p></section>`;
  const sessions = openSessions(race, now);
  const next = sessions[0];
  const key = String(race.round);
  const tipsFor = next?.kind === 'sprint' ? g.sprintTips[key] || {} : g.raceTips[key] || {};

  return html`<section class="card hero" aria-labelledby="next-title">
    <div class="hero-kicker">Runde ${race.round} von ${g.races.length}${race.sprint ? html` · <span class="badge badge-sprint">Sprint-Wochenende</span>` : ''}</div>
    <h1 id="next-title" class="hero-title"><span class="flag" aria-hidden="true">${flag(race.countryCode)}</span> ${shortRaceName(race)}</h1>
    <div class="hero-sub">${race.circuit} · ${race.city}</div>
    ${next && html`<div class="hero-deadline">
      <div class="label">Tippschluss ${next.label}</div>
      <${Countdown} target=${next.start} now=${now} />
    </div>`}
    <ul class="sessions">
      ${race.qualiStartUTC && html`<li><span>Qualifying</span><time>${fmtWeekdayTime(race.qualiStartUTC)}</time></li>`}
      ${race.sprint && race.sprintStartUTC && html`<li><span>Sprint</span><time>${fmtWeekdayTime(race.sprintStartUTC)}</time></li>`}
      <li><span>Rennen</span><time>${fmtWeekdayTime(race.raceStartUTC)}</time></li>
    </ul>
    ${next && me && html`<${Link} href=${`/rennen/${race.round}`} class="btn btn-big">${tipsFor[me.id] ? `${next.label}-Tipp ansehen / ändern` : `Jetzt ${next.label} tippen`}</${Link}>`}
    ${next && !me && html`<p class="muted small">Zum Tippen deinen persönlichen Link öffnen.</p>`}
    ${!next && html`<${Link} href=${`/rennen/${race.round}`} class="btn btn-ghost">Alle Tipps ansehen</${Link}>`}
    ${next && html`<div class="tipstatus" aria-label="Wer hat schon getippt?">
      ${g.players.map((p) => {
        const done = !!tipsFor[p.id];
        return html`<div class=${`tipchip ${done ? 'is-done' : ''}`} style=${`--pc:${p.color}`}>
          <span aria-hidden="true">${p.emoji}</span> ${p.name}<b>${done ? '✓ getippt' : 'offen'}</b>
        </div>`;
      })}
    </div>`}
  </section>`;
}

function MiniStandings({ g }) {
  const rows = standingsWithHistory(g);
  const done = finishedRounds(g);
  const lastRace = done.length ? g.raceByRound[done[done.length - 1]] : null;
  return html`<section class="card">
    <div class="card-head"><h2>Tabelle</h2><${Link} href="/tabelle" class="more">Alle Details →</${Link}></div>
    <ol class="mini-table">
      ${rows.map((r) => html`<li style=${`--pc:${g.playerById[r.playerId].color}`}>
        <span class="pos">${r.position}</span>
        <${Player} p=${g.playerById[r.playerId]} />
        <${Move} n=${r.move} />
        <span class="gap">${r.gapToLeader ? `−${r.gapToLeader}` : ''}</span>
        <span class="total">${r.totalPoints}</span>
      </li>`)}
    </ol>
    ${lastRace && html`<p class="muted small">Stand nach ${shortRaceName(lastRace)} (Runde ${lastRace.round}).</p>`}
  </section>`;
}

function LastRace({ g }) {
  const done = finishedRounds(g);
  if (!done.length) return null;
  const round = done[done.length - 1];
  const race = g.raceByRound[round];
  const res = g.raceResults[String(round)];
  const rows = standingsWithHistory(g).slice().sort((a, b) => b.lastWeekend - a.lastWeekend);
  const best = rows[0]?.lastWeekend;
  return html`<section class="card">
    <div class="card-head"><h2>Letztes Rennen</h2><span class="muted small">${fmtDay(race.raceStartUTC)}</span></div>
    <${Link} href=${`/rennen/${round}`} class="last-race-title"><span class="flag" aria-hidden="true">${flag(race.countryCode)}</span> ${shortRaceName(race)} <span class="muted small">Tipps ansehen →</span></${Link}>
    <ol class="podium-line">
      ${[0, 1, 2].map((i) => html`<li><span class="ppos">P${i + 1}</span><${Driver} g=${g} id=${i === 0 ? res.winner : res.podium[i]} /></li>`)}
    </ol>
    <ul class="weekend-points">
      ${rows.map((r) => html`<li class=${r.lastWeekend === best && best > 0 ? 'is-best' : ''}>
        <${Player} p=${g.playerById[r.playerId]} size="sm" /><b>+${r.lastWeekend}</b>${r.lastWeekend === best && best > 0 ? html`<span class="crown" title="Bester Tipp des Wochenendes">👑</span>` : ''}
      </li>`)}
    </ul>
  </section>`;
}

function News({ g }) {
  if (!g.news?.length) return null;
  const n = g.news[0];
  return html`<section class="card news">
    <div class="card-head"><h2>Neuigkeiten</h2><span class="muted small">${fmtDay(n.date)}</span></div>
    <ul>${n.items.map((t) => html`<li>${t}</li>`)}</ul>
  </section>`;
}

export function Home({ g, me, now }) {
  return html`<div class="stack home">
    <${NextRace} g=${g} me=${me} now=${now} />
    <div class="grid-2">
      <${MiniStandings} g=${g} />
      <${LastRace} g=${g} />
    </div>
    <${News} g=${g} />
  </div>`;
}
