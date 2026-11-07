// Admin (Viktor): enter results (with suggestion from the F1 results API), season final, news, personal links.
import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { toast } from '../lib/toast.js';
import { shortRaceName, flag, lastName } from '../lib/format.js';
import { Picker, SPRINT_SLOTS, SEASON_SLOTS } from './picker.js';
import { Player } from './parts.js';

const RESULT_SLOTS = [
  { key: 'p1', label: 'Sieger', short: 'P1', kind: 'driver', group: 'podium' },
  { key: 'p2', label: 'P2', short: 'P2', kind: 'driver', group: 'podium' },
  { key: 'p3', label: 'P3', short: 'P3', kind: 'driver', group: 'podium' },
  { key: 'pole', label: 'Pole', short: 'Pole', kind: 'driver' },
  { key: 'fastestLap', label: 'Schnellste Runde', short: 'SR', kind: 'driver' },
  { key: 'bestConstructor', label: 'Konstrukteur', short: 'Team', kind: 'team', hint: 'meiste Punkte im Rennen, bei Gleichstand beste Platzierung' },
];

async function api(path, method, body) {
  const res = await fetch(`/api/admin${path}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

function MultiDrivers({ g, label, value, onChange, exclude = [] }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return html`<fieldset class="multi">
    <legend>${label} <span class="muted small">${value.length ? value.map((id) => lastName(g.driverById[id])).join(', ') : 'keiner'}</span></legend>
    <div class="multi-grid">
      ${g.drivers.map((d) => html`<button type="button" class=${`chip ${value.includes(d.id) ? 'is-on' : ''}`} style=${`--tc:${g.teamById[d.team]?.color}`}
        disabled=${exclude.includes(d.id)} aria-pressed=${value.includes(d.id)} onClick=${() => toggle(d.id)}>${lastName(d)}</button>`)}
    </div>
  </fieldset>`;
}

function fromResult(res) {
  if (!res) return { p1: '', p2: '', p3: '', pole: '', fastestLap: '', bestConstructor: '', dnf: [], dns: [], topTen: [] };
  return { p1: res.podium?.[0] || res.winner || '', p2: res.podium?.[1] || '', p3: res.podium?.[2] || '', pole: res.pole || '', fastestLap: res.fastestLap || '', bestConstructor: res.bestConstructor || '', dnf: res.dnf || [], dns: res.dns || [], topTen: res.topTen || [] };
}

function ResultEditor({ g, race, reload }) {
  const key = String(race.round);
  const [v, setV] = useState(() => fromResult(g.raceResults[key]));
  const [s, setS] = useState(() => ({ p1: g.sprintResults[key]?.podium?.[0] || '', p2: g.sprintResults[key]?.podium?.[1] || '', p3: g.sprintResults[key]?.podium?.[2] || '' }));
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const prefill = async () => {
    setBusy('prefill'); setNote('');
    try {
      const data = await api(`/prefill/${race.round}`, 'GET');
      if (!data.race) { setNote('Noch kein Ergebnis verfügbar.'); return; }
      setV({ p1: data.race.podium[0], p2: data.race.podium[1], p3: data.race.podium[2], pole: data.race.pole, fastestLap: data.race.fastestLap, bestConstructor: data.race.bestConstructor, dnf: data.race.dnf || [], dns: data.race.dns || [], topTen: data.race.topTen || [] });
      if (data.sprint) setS({ p1: data.sprint.podium[0], p2: data.sprint.podium[1], p3: data.sprint.podium[2] });
      setNote(`Vorschlag geladen – bitte prüfen und speichern.${data.unmapped?.length ? ` Nicht zugeordnet: ${data.unmapped.join(', ')}.` : ''}`);
    } catch (e) { setNote(e.message); } finally { setBusy(''); }
  };

  const save = async () => {
    setBusy('save');
    try {
      await api(`/results/race/${race.round}`, 'PUT', { podium: [v.p1, v.p2, v.p3], pole: v.pole, fastestLap: v.fastestLap, bestConstructor: v.bestConstructor, dnf: v.dnf, dns: v.dns, topTen: v.topTen });
      if (race.sprint && s.p1 && s.p2 && s.p3) await api(`/results/sprint/${race.round}`, 'PUT', { podium: [s.p1, s.p2, s.p3] });
      toast(`Ergebnis ${shortRaceName(race)} gespeichert ✓`);
      await reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const remove = async () => {
    if (!g.raceResults[key]) return;
    setBusy('delete');
    try { await api(`/results/race/${race.round}`, 'DELETE'); toast('Ergebnis gelöscht'); await reload(); setV(fromResult(null)); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const complete = RESULT_SLOTS.every((x) => v[x.key]);
  return html`<div class="stack">
    <div class="row-between">
      <h2><span aria-hidden="true">${flag(race.countryCode)}</span> ${shortRaceName(race)} <span class="muted small">Runde ${race.round}</span></h2>
      <button class="btn btn-ghost btn-sm" onClick=${prefill} disabled=${!!busy}>${busy === 'prefill' ? 'Lade …' : 'Vorschlag laden'}</button>
    </div>
    ${note && html`<p class="saved-note">${note}</p>`}
    <${Picker} key=${`r${race.round}`} g=${g} slots=${RESULT_SLOTS} value=${v} onChange=${(x) => setV({ ...v, ...x })} />
    ${race.dnfDns && html`
      <${MultiDrivers} g=${g} label="DNF (gestartet, nicht im Ziel)" value=${v.dnf} exclude=${v.dns} onChange=${(dnf) => setV({ ...v, dnf })} />
      <${MultiDrivers} g=${g} label="DNS (nicht gestartet)" value=${v.dns} exclude=${v.dnf} onChange=${(dns) => setV({ ...v, dns })} />`}
    ${race.sprint && html`<div class="card inset"><h3>Sprint</h3><${Picker} key=${`s${race.round}`} g=${g} slots=${SPRINT_SLOTS} value=${s} onChange=${setS} /></div>`}
    <div class="submitbar">
      ${g.raceResults[key] ? html`<button class="btn btn-ghost btn-sm" onClick=${remove} disabled=${!!busy}>Ergebnis löschen</button>` : html`<span class="muted small">${complete ? 'Bereit' : 'Noch nicht vollständig'}</span>`}
      <button class="btn" onClick=${save} disabled=${!complete || !!busy}>${busy === 'save' ? 'Speichere …' : 'Ergebnis speichern'}</button>
    </div>
  </div>`;
}

function Results({ g, now, reload }) {
  const started = g.races.filter((r) => new Date(r.raceStartUTC).getTime() <= now || g.raceResults[String(r.round)]);
  const firstMissing = started.find((r) => !g.raceResults[String(r.round)]);
  const [round, setRound] = useState((firstMissing || started[started.length - 1] || g.races[0]).round);
  const race = g.raceByRound[round];
  return html`<section class="card stack">
    <label class="field"><span>Rennen</span>
      <select value=${round} onChange=${(e) => setRound(Number(e.target.value))}>
        ${g.races.map((r) => html`<option value=${r.round}>${r.round}. ${shortRaceName(r)}${g.raceResults[String(r.round)] ? ' ✓' : ''}</option>`)}
      </select>
    </label>
    <${ResultEditor} key=${round} g=${g} race=${race} reload=${reload} />
  </section>`;
}

function News({ g, reload }) {
  const [text, setText] = useState('');
  const post = async () => {
    try { await api('/news', 'POST', { items: text.split('\n') }); setText(''); toast('Neuigkeit veröffentlicht ✓'); await reload(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const del = async (id) => { try { await api(`/news/${id}`, 'DELETE'); await reload(); } catch (e) { toast(e.message, 'error'); } };
  return html`<section class="card stack">
    <h2>Neuigkeiten</h2>
    <p class="muted small">Erscheint auf der Startseite. Eine Zeile pro Punkt, kurz und für Mitspieler (z. B. „Ergebnis Brasilien ist eingetragen.“).</p>
    <textarea rows="3" value=${text} onInput=${(e) => setText(e.target.value)} placeholder="Ergebnis Brasilien ist eingetragen."></textarea>
    <div><button class="btn" onClick=${post} disabled=${!text.trim()}>Veröffentlichen</button></div>
    <ul class="news-admin">${(g.news || []).map((n) => html`<li><span>${n.items.join(' · ')}</span><button class="linkish" onClick=${() => del(n.id)}>löschen</button></li>`)}</ul>
  </section>`;
}

function Links({ g }) {
  const [links, setLinks] = useState({});
  const make = async (pid) => {
    try { const { link } = await api(`/players/${pid}/link`, 'POST'); setLinks({ ...links, [pid]: link }); }
    catch (e) { toast(e.message, 'error'); }
  };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('Link kopiert'); } catch { toast('Kopieren nicht möglich – bitte markieren.', 'error'); } };
  return html`<section class="card stack">
    <h2>Persönliche Links</h2>
    <p class="muted small">Ein neuer Link ersetzt den alten (z. B. neues Handy). Der Link wird nur jetzt angezeigt – direkt per WhatsApp schicken.</p>
    <ul class="links">${g.players.map((p) => html`<li>
      <${Player} p=${p} />
      ${links[p.id] ? html`<span class="link-out"><input readonly value=${links[p.id]} onFocus=${(e) => e.target.select()} /><button class="btn btn-sm" onClick=${() => copy(links[p.id])}>Kopieren</button></span>`
        : html`<button class="btn btn-ghost btn-sm" onClick=${() => make(p.id)}>Neuen Link erstellen</button>`}
    </li>`)}</ul>
  </section>`;
}

function SeasonFinal({ g, reload }) {
  const [v, setV] = useState(g.seasonFinal || { wdc: '', wcc: '' });
  const save = async () => { try { await api('/season-final', 'PUT', v); toast('Saisonende gespeichert ✓'); await reload(); } catch (e) { toast(e.message, 'error'); } };
  return html`<section class="card stack">
    <h2>Saisonende</h2>
    <p class="muted small">Erst nach dem letzten Rennen eintragen – dann zählen die Saison-Tipps (20 + 15 Punkte).</p>
    <${Picker} g=${g} slots=${SEASON_SLOTS} value=${v} onChange=${setV} />
    <div><button class="btn" onClick=${save} disabled=${!v.wdc || !v.wcc}>Saisonende speichern</button></div>
  </section>`;
}

const TABS = [['ergebnisse', 'Ergebnisse'], ['news', 'Neuigkeiten'], ['links', 'Links'], ['saison', 'Saisonende']];

export function Admin({ g, me, now, reload }) {
  const [tab, setTab] = useState('ergebnisse');
  if (!me?.isAdmin) return html`<div class="empty"><p>Dieser Bereich ist nur für Admins.</p></div>`;
  return html`<div class="stack">
    <header class="page-head"><h1>Admin</h1></header>
    <div class="segmented four" role="tablist">
      ${TABS.map(([k, l]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'is-on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}
    </div>
    ${tab === 'ergebnisse' && html`<${Results} g=${g} now=${now} reload=${reload} />`}
    ${tab === 'news' && html`<${News} g=${g} reload=${reload} />`}
    ${tab === 'links' && html`<${Links} g=${g} />`}
    ${tab === 'saison' && html`<${SeasonFinal} g=${g} reload=${reload} />`}
  </div>`;
}
