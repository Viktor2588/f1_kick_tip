// Race weekend page: tip form while open, everyone's tips revealed after lights-out, points once the result is in.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Link } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { flag, fmtWeekdayTime, fmtTime, shortRaceName, relative, fmtDateTime } from '../lib/format.js';
import { deadline, isOpen, validateRaceTip, validateSprintTip } from '../../shared/tips.js';
import { scoreRace, scoreSprint } from '../../shared/scoring.js';
import { Player, Driver, Team } from './parts.js';
import { Picker, RACE_SLOTS, SPRINT_SLOTS, toValue, toBody } from './picker.js';

const draftKey = (kind, round, pid) => `kt-draft-${kind}-${round}-${pid}`;
const loadDraft = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const saveDraft = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const dropDraft = (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } };

function TipForm({ g, race, kind, me, now, reload }) {
  const key = String(race.round);
  const existing = (kind === 'race' ? g.raceTips : g.sprintTips)[key]?.[me.id];
  const dk = draftKey(kind, race.round, me.id);
  const [value, setValue] = useState(() => loadDraft(dk) || toValue(kind, existing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slots = kind === 'race' ? RACE_SLOTS(race.dnfDns) : SPRINT_SLOTS;
  const known = useMemo(() => ({ drivers: new Set(g.drivers.map((d) => d.id)), teams: new Set(g.teams.map((t) => t.id)) }), [g]);
  const check = (v) => (kind === 'race' ? validateRaceTip(toBody(kind, v), race, known) : validateSprintTip(toBody(kind, v), race, known)).errors;
  const missing = slots.filter((s) => !s.optional && !value[s.key]).length;
  const dirty = JSON.stringify(toValue(kind, existing)) !== JSON.stringify({ ...toValue(kind, existing), ...value });

  // My previous tip of the same kind, to start from.
  const previous = useMemo(() => {
    const all = kind === 'race' ? g.raceTips : g.sprintTips;
    const rounds = g.races.filter((r) => r.round < race.round && all[String(r.round)]?.[me.id] && !all[String(r.round)][me.id].hidden).map((r) => r.round);
    return rounds.length ? all[String(rounds[rounds.length - 1])][me.id] : null;
  }, [g, race, kind, me]);

  const update = (v) => { setValue(v); setError(''); saveDraft(dk, v); };

  const submit = async (e) => {
    e.preventDefault();
    const errors = check(value);
    if (errors.length) { setError(errors[0]); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/tips/${kind}/${race.round}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toBody(kind, value)) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Speichern fehlgeschlagen.'); return; }
      dropDraft(dk);
      toast(existing ? 'Tipp geändert ✓' : 'Tipp abgegeben ✓');
      await reload();
    } catch {
      setError('Keine Verbindung. Dein Tipp ist hier gespeichert, versuch es gleich nochmal.');
    } finally {
      setBusy(false);
    }
  };

  const close = deadline(kind, race, g.races);
  return html`<form class="tipform" onSubmit=${submit}>
    <div class="tipform-head">
      <div>
        <h2>${kind === 'race' ? 'Dein Renntipp' : 'Dein Sprint-Tipp'}</h2>
        <p class="muted small">Tippschluss ${fmtWeekdayTime(close)} · ${relative(close, now)}</p>
      </div>
      ${previous && !existing && html`<button type="button" class="btn btn-ghost btn-sm" onClick=${() => update({ ...value, ...toValue(kind, previous) })}>Letzten Tipp übernehmen</button>`}
    </div>
    ${existing && html`<p class="saved-note">✓ Abgegeben ${fmtDateTime(existing.submittedAt)} – du kannst bis zum Start ändern.</p>`}
    <${Picker} g=${g} slots=${slots} value=${value} onChange=${update} />
    <div class="submitbar">
      ${error ? html`<span class="form-error" role="alert">${error}</span>` : html`<span class="muted small">${missing ? `Noch ${missing} offen` : existing && !dirty ? 'Gespeichert' : 'Alles ausgefüllt'}</span>`}
      <button class="btn" type="submit" disabled=${busy || missing > 0 || (existing && !dirty)}>${busy ? 'Speichere …' : existing ? 'Tipp ändern' : 'Tipp abgeben'}</button>
    </div>
  </form>`;
}

const RACE_ROWS = [
  { key: 'winner', label: 'Sieger', get: (t) => t.winner, res: (r) => r.winner, type: 'driver', pts: 'winner' },
  { key: 'p2', label: 'P2', get: (t) => t.podium?.[1], res: (r) => r.podium?.[1], type: 'driver', pts: 'podiumP2' },
  { key: 'p3', label: 'P3', get: (t) => t.podium?.[2], res: (r) => r.podium?.[2], type: 'driver', pts: 'podiumP3' },
  { key: 'pole', label: 'Pole', get: (t) => t.pole, res: (r) => r.pole, type: 'driver', pts: 'pole' },
  { key: 'fastestLap', label: 'Schnellste Runde', short: 'SR', get: (t) => t.fastestLap, res: (r) => r.fastestLap, type: 'driver', pts: 'fastestLap' },
  { key: 'bestConstructor', label: 'Konstrukteur', short: 'Team', get: (t) => t.bestConstructor, res: (r) => r.bestConstructor, type: 'team', pts: 'bestConstructor' },
  { key: 'dnf', label: 'DNF', get: (t) => t.dnf, res: (r) => r.dnf, type: 'driver', pts: 'dnf', list: true, only: (race) => race.dnfDns },
  { key: 'dns', label: 'DNS', get: (t) => t.dns, res: (r) => r.dns, type: 'driver', pts: 'dns', list: true, only: (race) => race.dnfDns },
];
const SPRINT_ROWS = [
  { key: 'winner', label: 'Sieger', get: (t) => t.podium?.[0] || t.winner, res: (r) => r.winner, type: 'driver', pts: 'sprintWinner' },
  { key: 'p2', label: 'P2', get: (t) => t.podium?.[1], res: (r) => r.podium?.[1], type: 'driver', pts: 'sprintP2' },
  { key: 'p3', label: 'P3', get: (t) => t.podium?.[2], res: (r) => r.podium?.[2], type: 'driver', pts: 'sprintP3' },
];

/** Everyone's tips side by side, with points once the result is in. */
function Reveal({ g, race, kind, me }) {
  const key = String(race.round);
  const tips = (kind === 'race' ? g.raceTips : g.sprintTips)[key] || {};
  const result = (kind === 'race' ? g.raceResults : g.sprintResults)[key];
  const rows = (kind === 'race' ? RACE_ROWS : SPRINT_ROWS).filter((r) => !r.only || r.only(race));
  const players = g.players.filter((p) => tips[p.id]);
  if (!players.length) return html`<p class="muted">Niemand hat getippt.</p>`;
  const scores = Object.fromEntries(players.map((p) => [p.id, result ? (kind === 'race' ? scoreRace(tips[p.id], result, race) : scoreSprint(tips[p.id], result, race)) : null]));
  const cell = (type, id) => (id ? (type === 'team' ? html`<${Team} g=${g} id=${id} />` : html`<${Driver} g=${g} id=${id} />`) : html`<span class="muted">–</span>`);
  const resCell = (row) => {
    const v = row.res(result);
    if (row.list) return v?.length ? v.map((id) => html`<div>${cell('driver', id)}</div>`) : html`<span class="muted">–</span>`;
    return cell(row.type, v);
  };

  return html`<div class="reveal-wrap"><table class="reveal">
    <thead><tr>
      <th scope="col"><span class="sr">Tipp</span></th>
      ${players.map((p) => html`<th scope="col" class=${p.id === me?.id ? 'is-me' : ''}><${Player} p=${p} size="sm" /></th>`)}
      ${result && html`<th scope="col" class="res-col"><span class="nm-full">Ergebnis</span><span class="nm-code">🏁</span></th>`}
    </tr></thead>
    <tbody>
      ${rows.map((row) => html`<tr>
        <th scope="row">${row.short ? html`<span class="nm-full">${row.label}</span><span class="nm-code">${row.short}</span>` : row.label}</th>
        ${players.map((p) => {
          const s = scores[p.id];
          const got = s && s.breakdown[row.pts] > 0;
          const bonus = s && kind === 'race' && ['winner', 'p2', 'p3'].includes(row.key) && !got && result.podium?.includes(row.get(tips[p.id]));
          const sbonus = s && kind === 'sprint' && !got && result.podium?.includes(row.get(tips[p.id]));
          return html`<td class=${got ? 'hit' : bonus || sbonus ? 'near' : ''}>${cell(row.type, row.get(tips[p.id]))}${got ? html`<span class="gain">+${s.breakdown[row.pts]}</span>` : bonus || sbonus ? html`<span class="gain">+1</span>` : ''}</td>`;
        })}
        ${result && html`<td class="res-col">${resCell(row)}</td>`}
      </tr>`)}
    </tbody>
    ${result && html`<tfoot><tr>
      <th scope="row">Punkte</th>
      ${players.map((p) => {
        const s = scores[p.id];
        return html`<td class="sum">${s.late ? html`<span class="late">zu spät</span>` : html`<b>${s.total}</b>`}${s.isPerfect ? html`<span class="perfect" title=${kind === 'race' ? 'Perfekte Runde (+5)' : 'Perfekter Sprint (+2)'}>★</span>` : ''}</td>`;
      })}
      <td class="res-col"></td>
    </tr></tfoot>`}
  </table></div>
  ${result && html`<p class="muted small">Grün = Treffer, gelb = auf dem Podium, aber andere Position (+1).${kind === 'race' ? ' ★ = perfekte Runde (+5).' : ' ★ = perfekter Sprint (+2).'}</p>`}`;
}

function WhoTipped({ g, race, kind }) {
  const tips = (kind === 'race' ? g.raceTips : g.sprintTips)[String(race.round)] || {};
  return html`<div class="tipstatus">
    ${g.players.map((p) => html`<div class=${`tipchip ${tips[p.id] ? 'is-done' : ''}`} style=${`--pc:${p.color}`}>
      <span aria-hidden="true">${p.emoji}</span> ${p.name}<b>${tips[p.id] ? '✓ getippt' : 'offen'}</b>
    </div>`)}
  </div>
  <p class="muted small">Die Tipps der anderen siehst du ab dem Start.</p>`;
}

function Session({ g, race, kind, me, now, reload }) {
  const close = deadline(kind, race, g.races);
  const open = isOpen(close, now);
  const result = (kind === 'race' ? g.raceResults : g.sprintResults)[String(race.round)];
  return html`<div class="stack">
    ${open && me && html`<section class="card"><${TipForm} g=${g} race=${race} kind=${kind} me=${me} now=${now} reload=${reload} /></section>`}
    ${open && !me && html`<section class="card notice"><h2>Tippen</h2><p>Um zu tippen, öffne deinen persönlichen Link, den du von Viktor bekommen hast. Danach bist du auf diesem Gerät angemeldet.</p></section>`}
    <section class="card">
      <div class="card-head"><h2>${open ? 'Wer hat schon getippt?' : result ? 'Tipps & Punkte' : 'Alle Tipps'}</h2>
        ${!open && !result && html`<span class="muted small">Ergebnis folgt</span>`}</div>
      ${open ? html`<${WhoTipped} g=${g} race=${race} kind=${kind} />` : html`<${Reveal} g=${g} race=${race} kind=${kind} me=${me} />`}
    </section>
  </div>`;
}

export function Race({ g, round, me, now, reload }) {
  const race = g.raceByRound[round];
  const sprintOpen = race?.sprint && isOpen(race.sprintStartUTC, now);
  const [tab, setTab] = useState(sprintOpen ? 'sprint' : 'race');
  useEffect(() => { setTab(race?.sprint && isOpen(race.sprintStartUTC, now) ? 'sprint' : 'race'); }, [round]);
  if (!race) return html`<div class="empty"><p>Dieses Rennen gibt es nicht.</p><${Link} href="/rennen">Zum Kalender</${Link}></div>`;
  const prev = g.raceByRound[round - 1], next = g.raceByRound[round + 1];

  return html`<div class="stack race">
    <header class="race-head">
      <div class="race-nav">
        ${prev ? html`<${Link} href=${`/rennen/${prev.round}`} aria-label=${`Vorheriges Rennen: ${shortRaceName(prev)}`}>‹ ${shortRaceName(prev)}</${Link}>` : html`<span></span>`}
        ${next ? html`<${Link} href=${`/rennen/${next.round}`} aria-label=${`Nächstes Rennen: ${shortRaceName(next)}`}>${shortRaceName(next)} ›</${Link}>` : html`<span></span>`}
      </div>
      <div class="hero-kicker">Runde ${race.round} · ${race.circuit}</div>
      <h1><span class="flag" aria-hidden="true">${flag(race.countryCode)}</span> ${shortRaceName(race)}</h1>
      <ul class="sessions inline">
        ${race.qualiStartUTC && html`<li><span>Quali</span><time>${fmtWeekdayTime(race.qualiStartUTC)}</time></li>`}
        ${race.sprint && html`<li><span>Sprint</span><time>${fmtWeekdayTime(race.sprintStartUTC)}</time></li>`}
        <li><span>Rennen</span><time>${fmtWeekdayTime(race.raceStartUTC)}</time></li>
      </ul>
    </header>
    ${race.sprint && html`<div class="segmented" role="tablist">
      <button role="tab" aria-selected=${tab === 'sprint'} class=${tab === 'sprint' ? 'is-on' : ''} onClick=${() => setTab('sprint')}>Sprint · ${fmtTime(race.sprintStartUTC)}</button>
      <button role="tab" aria-selected=${tab === 'race'} class=${tab === 'race' ? 'is-on' : ''} onClick=${() => setTab('race')}>Rennen · ${fmtTime(race.raceStartUTC)}</button>
    </div>`}
    <${Session} key=${tab} g=${g} race=${race} kind=${race.sprint ? tab : 'race'} me=${me} now=${now} reload=${reload} />
  </div>`;
}
