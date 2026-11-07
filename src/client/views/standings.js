import { html } from '../lib/html.js';
import { standingsWithHistory, finishedRounds } from '../lib/derive.js';
import { Player, Move, PointsChart } from './parts.js';
import { shortRaceName } from '../lib/format.js';

export function Standings({ g }) {
  const rows = standingsWithHistory(g);
  const rounds = finishedRounds(g);
  const last = rounds.length ? g.raceByRound[rounds[rounds.length - 1]] : null;
  const leader = rows[0]?.totalPoints || 1;

  return html`<div class="stack">
    <header class="page-head">
      <h1>Tabelle</h1>
      <p class="muted">${last ? `Nach ${rounds.length} von ${g.races.length} Rennen · zuletzt ${shortRaceName(last)}` : 'Noch keine Ergebnisse'}</p>
    </header>

    <section class="card">
      <ol class="table">
        ${rows.map((r) => {
          const p = g.playerById[r.playerId];
          return html`<li style=${`--pc:${p.color}`}>
            <div class="row-main">
              <span class="pos">${r.position}</span>
              <${Player} p=${p} size="lg" />
              <${Move} n=${r.move} />
              <span class="total"><b>${r.totalPoints}</b><small>Pkt</small></span>
            </div>
            <div class="bar" aria-hidden="true"><span style=${`width:${Math.max(2, (r.totalPoints / leader) * 100)}%`}></span></div>
            <dl class="stats">
              <div><dt>Rennen</dt><dd>${r.racePoints}</dd></div>
              <div><dt>Sprint</dt><dd>${r.sprintPoints}</dd></div>
              <div><dt>Sieger ✓</dt><dd>${r.correctWinners}</dd></div>
              <div><dt>Perfekt</dt><dd>${r.perfectRounds}</dd></div>
              <div><dt>Pole ✓</dt><dd>${r.correctPoles}</dd></div>
              <div><dt>Trefferquote</dt><dd>${r.accuracy}%</dd></div>
              ${r.seasonPoints > 0 && html`<div><dt>Saison-Tipp</dt><dd>${r.seasonPoints}</dd></div>`}
            </dl>
          </li>`;
        })}
      </ol>
      <p class="muted small">Gleichstand: zuerst mehr richtige Sieger, dann mehr perfekte Runden, dann mehr richtige Poles.</p>
    </section>

    ${rounds.length > 1 && html`<section class="card">
      <div class="card-head"><h2>Punkteverlauf</h2></div>
      <${PointsChart} g=${g} rows=${rows} rounds=${rounds} />
    </section>`}
  </div>`;
}
