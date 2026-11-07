import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { toast } from '../lib/toast.js';
import { deadline, isOpen } from '../../shared/tips.js';
import { Picker, SEASON_SLOTS, toValue, toBody } from './picker.js';
import { fmtWeekdayTime } from '../lib/format.js';
import { standingsWithHistory, finishedRounds } from '../lib/derive.js';
import { Player, Move, PointsChart, Driver, Team } from './parts.js';
import { shortRaceName } from '../lib/format.js';

function SeasonTipForm({ g, me, reload }) {
  const existing = g.seasonTips[me.id];
  const [v, setV] = useState(() => toValue('season', existing));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/tips/season', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toBody('season', v)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast('Saison-Tipp gespeichert ✓');
      await reload();
    } catch (e) { toast(e.message || 'Speichern fehlgeschlagen.', 'error'); } finally { setBusy(false); }
  };
  return html`<div class="stack">
    <p class="muted small">Tippschluss ${fmtWeekdayTime(deadline('season', null, g.races))} (Start von Runde 1).</p>
    <${Picker} g=${g} slots=${SEASON_SLOTS} value=${v} onChange=${setV} />
    <div><button class="btn" onClick=${save} disabled=${busy || !v.wdc || !v.wcc}>${existing ? 'Saison-Tipp ändern' : 'Saison-Tipp abgeben'}</button></div>
  </div>`;
}

export function Standings({ g, me, now, reload }) {
  const seasonOpen = isOpen(deadline('season', null, g.races), now);
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

    <section class="card">
      <div class="card-head"><h2>Saison-Tipps</h2><span class="muted small">WM 20 · Konstrukteure 15 Punkte</span></div>
      <ul class="season-tips">
        ${g.players.map((p) => {
          const t = g.seasonTips[p.id];
          return html`<li><${Player} p=${p} />
            ${!t ? html`<span class="muted">kein Tipp</span>` : t.hidden ? html`<span class="muted">✓ getippt</span>` : html`<span class="st"><${Driver} g=${g} id=${t.wdc} full /><${Team} g=${g} id=${t.wcc} /></span>`}
          </li>`;
        })}
      </ul>
      ${g.seasonFinal ? '' : html`<p class="muted small">Wird nach dem letzten Rennen aufgelöst.</p>`}
      ${seasonOpen && me && html`<${SeasonTipForm} g=${g} me=${me} reload=${reload} />`}
    </section>

    ${rounds.length > 1 && html`<section class="card">
      <div class="card-head"><h2>Punkteverlauf</h2></div>
      <${PointsChart} g=${g} rows=${rows} rounds=${rounds} />
    </section>`}
  </div>`;
}
