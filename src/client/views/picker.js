// Tap-to-tip: pick the active slot at the top, tap a driver (or team) below, the next empty slot becomes active.
import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { lastName } from '../lib/format.js';

export function Picker({ g, slots, value, onChange }) {
  const firstEmpty = slots.find((s) => !s.optional && !value[s.key]) || slots[0];
  const [active, setActive] = useState(firstEmpty.key);
  const slot = slots.find((s) => s.key === active) || slots[0];
  const exclusive = slot.group ? slots.filter((s) => s.group === slot.group && s.key !== slot.key) : [];

  const choose = (id) => {
    const next = { ...value };
    // Same driver can't be on two podium spots (or DNF and DNS): move it instead of duplicating.
    for (const other of exclusive) if (next[other.key] === id) next[other.key] = '';
    next[slot.key] = next[slot.key] === id && slot.optional ? '' : id;
    onChange(next);
    const idx = slots.indexOf(slot);
    const after = [...slots.slice(idx + 1), ...slots.slice(0, idx)].find((s) => !next[s.key] && !s.optional);
    if (after) setActive(after.key);
    else if (idx < slots.length - 1 && !slots[idx + 1].optional) setActive(slots[idx + 1].key);
  };

  const usedBy = (id) => slots.filter((s) => s.kind === slot.kind && value[s.key] === id).map((s) => s.short);

  return html`<div class="picker">
    <div class="slots" role="tablist" aria-label="Tipp-Kategorien">
      ${slots.map((s) => {
        const v = value[s.key];
        const label = v ? (s.kind === 'team' ? g.teamById[v]?.name : lastName(g.driverById[v])) : s.optional ? 'optional' : 'wählen';
        const color = v ? (s.kind === 'team' ? g.teamById[v]?.color : g.teamById[g.driverById[v]?.team]?.color) : 'transparent';
        return html`<button type="button" role="tab" aria-selected=${s.key === active} class=${`slot ${s.key === active ? 'is-active' : ''} ${v ? 'is-set' : ''}`}
          style=${`--tc:${color}`} onClick=${() => setActive(s.key)}>
          <span class="slot-label">${s.label}</span><span class="slot-value">${label}</span>
        </button>`;
      })}
    </div>

    <div class="pick-hint">
      <b>${slot.label}</b>${slot.hint ? html` · <span class="muted">${slot.hint}</span>` : ''}
      ${slot.optional && value[slot.key] && html`<button type="button" class="linkish" onClick=${() => onChange({ ...value, [slot.key]: '' })}>entfernen</button>`}
    </div>

    ${slot.kind === 'team'
      ? html`<div class="team-grid">
          ${g.teams.map((t) => html`<button type="button" class=${`pick team-pick ${value[slot.key] === t.id ? 'is-picked' : ''}`} style=${`--tc:${t.color}`}
            aria-pressed=${value[slot.key] === t.id} onClick=${() => choose(t.id)}>${t.name}</button>`)}
        </div>`
      : html`<div class="driver-grid">
          ${g.teams.map((t) => html`<div class="team-block" style=${`--tc:${t.color}`}>
            <div class="team-name">${t.name}</div>
            ${g.drivers.filter((d) => d.team === t.id).map((d) => {
              const picked = value[slot.key] === d.id;
              const tags = usedBy(d.id).filter((x) => x !== slot.short);
              return html`<button type="button" class=${`pick driver-pick ${picked ? 'is-picked' : ''}`} aria-pressed=${picked} onClick=${() => choose(d.id)}>
                <span class="num">${d.number}</span><span class="nm">${lastName(d)}</span>
                ${tags.length > 0 && !picked && html`<span class="used">${tags.join(' ')}</span>`}
              </button>`;
            })}
          </div>`)}
        </div>`}
  </div>`;
}

export const RACE_SLOTS = (dnfDns) => [
  { key: 'p1', label: 'Sieger', short: 'P1', kind: 'driver', group: 'podium', hint: 'gewinnt das Rennen (= P1)' },
  { key: 'p2', label: 'P2', short: 'P2', kind: 'driver', group: 'podium' },
  { key: 'p3', label: 'P3', short: 'P3', kind: 'driver', group: 'podium' },
  { key: 'pole', label: 'Pole', short: 'Pole', kind: 'driver', hint: 'Schnellster im Qualifying' },
  { key: 'fastestLap', label: 'Schnellste Runde', short: 'SR', kind: 'driver' },
  { key: 'bestConstructor', label: 'Konstrukteur', short: 'Team', kind: 'team', hint: 'Team mit den meisten Punkten im Rennen' },
  ...(dnfDns ? [
    { key: 'dnf', label: 'DNF', short: 'DNF', kind: 'driver', group: 'out', optional: true, hint: 'startet, kommt nicht ins Ziel (3 Pkt)' },
    { key: 'dns', label: 'DNS', short: 'DNS', kind: 'driver', group: 'out', optional: true, hint: 'startet gar nicht (5 Pkt)' },
  ] : []),
];

export const SPRINT_SLOTS = [
  { key: 'p1', label: 'Sieger', short: 'P1', kind: 'driver', group: 'podium', hint: 'gewinnt den Sprint' },
  { key: 'p2', label: 'P2', short: 'P2', kind: 'driver', group: 'podium' },
  { key: 'p3', label: 'P3', short: 'P3', kind: 'driver', group: 'podium' },
];

export const SEASON_SLOTS = [
  { key: 'wdc', label: 'Weltmeister', short: 'WM', kind: 'driver', hint: '20 Punkte am Saisonende' },
  { key: 'wcc', label: 'Konstrukteurs-WM', short: 'Team', kind: 'team', hint: '15 Punkte am Saisonende' },
];

/** Tip (API shape) → picker value. */
export const toValue = (kind, tip) => {
  if (!tip || tip.hidden) return {};
  if (kind === 'season') return { wdc: tip.wdc || '', wcc: tip.wcc || '' };
  const v = { p1: tip.podium?.[0] || tip.winner || '', p2: tip.podium?.[1] || '', p3: tip.podium?.[2] || '' };
  if (kind === 'race') Object.assign(v, { pole: tip.pole || '', fastestLap: tip.fastestLap || '', bestConstructor: tip.bestConstructor || '', dnf: tip.dnf || '', dns: tip.dns || '' });
  return v;
};

/** Picker value → API body. */
export const toBody = (kind, v) => {
  if (kind === 'season') return { wdc: v.wdc, wcc: v.wcc };
  const body = { podium: [v.p1, v.p2, v.p3] };
  if (kind === 'race') Object.assign(body, { pole: v.pole, fastestLap: v.fastestLap, bestConstructor: v.bestConstructor, dnf: v.dnf || '', dns: v.dns || '' });
  return body;
};
