// Small shared UI pieces.
import { html } from '../lib/html.js';
import { lastName } from '../lib/format.js';

export function Player({ p, size = 'md' }) {
  return html`<span class=${`player player-${size}`} style=${`--pc:${p.color}`}>
    <span class="player-dot" aria-hidden="true">${p.emoji}</span><span class="player-name">${p.name}</span>
  </span>`;
}

export function Driver({ g, id, full = false }) {
  const d = g.driverById[id];
  if (!d) return html`<span class="driver driver-none">–</span>`;
  const team = g.teamById[d.team];
  const name = full ? d.name : lastName(d);
  const code = lastName(d).normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
  return html`<span class="driver" style=${`--tc:${team?.color || '#888'}`} title=${d.name}><span class="nm-full">${name}</span><span class="nm-code" aria-hidden="true">${code}</span></span>`;
}

export function Team({ g, id }) {
  const t = g.teamById[id];
  if (!t) return html`<span class="driver driver-none">–</span>`;
  const code = t.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return html`<span class="driver" style=${`--tc:${t.color}`} title=${t.name}><span class="nm-full">${t.name}</span><span class="nm-code" aria-hidden="true">${code}</span></span>`;
}

export function Move({ n }) {
  if (!n) return html`<span class="move move-0" title="unverändert">–</span>`;
  return n > 0
    ? html`<span class="move move-up" title=${`${n} ${n === 1 ? 'Platz' : 'Plätze'} hoch`}>▲${n}</span>`
    : html`<span class="move move-down" title=${`${-n} ${n === -1 ? 'Platz' : 'Plätze'} runter`}>▼${-n}</span>`;
}

/** Points over the season, one line per player, labelled at the line end. */
export function PointsChart({ g, rows, rounds }) {
  if (rounds.length < 2) return null;
  const W = 420, H = 230, padL = 30, padR = 78, padT = 12, padB = 24;
  const max = Math.max(10, ...rows.flatMap((r) => r.series));
  const top = Math.ceil(max / 50) * 50;
  const x = (i) => padL + (i / (rounds.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / top) * (H - padT - padB);
  const ticks = [0, top / 2, top];
  // Spread end labels so they never overlap.
  const ends = rows.map((r) => ({ id: r.playerId, y: y(r.series[r.series.length - 1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  const endY = Object.fromEntries(ends.map((e) => [e.id, e.y]));

  return html`<figure class="chart">
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Punkteverlauf über die Saison">
      ${ticks.map((t) => html`<g><line class="grid" x1=${padL} x2=${W - padR} y1=${y(t)} y2=${y(t)} /><text class="axis" x=${padL - 6} y=${y(t) + 4} text-anchor="end">${t}</text></g>`)}
      ${rounds.map((r, i) => (i % 4 === 0 || i === rounds.length - 1) && html`<text class="axis" x=${x(i)} y=${H - 6} text-anchor="middle">R${r}</text>`)}
      ${rows.map((r) => {
        const p = g.playerById[r.playerId];
        const d = r.series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
        const last = r.series.length - 1;
        return html`<g style=${`--pc:${p.color}`}>
          <path class="line" d=${d} />
          <circle class="dot" cx=${x(last)} cy=${y(r.series[last])} r="4" />
          <text class="end" x=${x(last) + 8} y=${endY[r.playerId] + 4}>${p.name} ${r.series[last]}</text>
        </g>`;
      })}
    </svg>
  </figure>`;
}
