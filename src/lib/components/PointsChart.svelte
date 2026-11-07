<script lang="ts">
  // Cumulative points per player over the season. Plain SVG, direct labels at line ends.
  import { playerById, raceByRound } from '$lib/domain/season';

  let { rounds, series }: { rounds: number[]; series: { playerId: string; points: number[] }[] } = $props();

  const W = 420, H = 230, L = 30, R = 78, T = 12, B = 24;
  const maxY = $derived(Math.max(10, ...series.flatMap((s) => s.points)));
  const niceMax = $derived(Math.ceil(maxY / 25) * 25);
  const x = (i: number) => L + (rounds.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (rounds.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / niceMax);
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f)));

  // Spread end labels so they don't overlap.
  const labels = $derived.by(() => {
    const ends = series.map((s) => ({ id: s.playerId, v: s.points.at(-1) ?? 0, y: y(s.points.at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    return ends;
  });
  let hover: number | null = $state(null);
</script>

{#if rounds.length}
  <figure class="chart">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Punkteverlauf über die Saison"
      onpointermove={(e) => {
        const r = (e.currentTarget as SVGElement).getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const i = Math.round(((px - L) / (W - L - R)) * (rounds.length - 1));
        hover = i >= 0 && i < rounds.length ? i : null;
      }}
      onpointerleave={() => (hover = null)}
    >
      {#each ticks as t}
        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="grid" />
        <text x={L - 6} y={y(t) + 4} class="axis" text-anchor="end">{t}</text>
      {/each}
      {#each rounds as r, i}
        {#if rounds.length < 8 || i % 3 === 0 || i === rounds.length - 1}
          <text x={x(i)} y={H - 6} class="axis" text-anchor="middle">R{r}</text>
        {/if}
      {/each}
      {#if hover !== null}<line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} class="cursor" />{/if}
      {#each series as s (s.playerId)}
        {@const c = playerById(s.playerId)?.color ?? '#888'}
        <polyline points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={c} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
        {#if hover !== null}<circle cx={x(hover)} cy={y(s.points[hover])} r="4.5" fill={c} stroke="var(--surface)" stroke-width="2" />{/if}
      {/each}
      {#each labels as l (l.id)}
        <text x={W - R + 8} y={l.y + 4} class="lbl" fill={playerById(l.id)?.color}>{playerById(l.id)?.name} {l.v}</text>
      {/each}
    </svg>
    {#if hover !== null}
      {@const race = raceByRound(rounds[hover])}
      <figcaption class="small">
        <b>Nach R{rounds[hover]} {race?.country}:</b>
        {#each [...series].sort((a, b) => b.points[hover!] - a.points[hover!]) as s}
          <span style:color={playerById(s.playerId)?.color}>{playerById(s.playerId)?.name} {s.points[hover]}</span>
        {/each}
      </figcaption>
    {:else}
      <figcaption class="small faint">Zum Ansehen über den Verlauf fahren oder tippen.</figcaption>
    {/if}
  </figure>
{/if}

<style>
  .chart { margin: 0; }
  svg { width: 100%; height: auto; display: block; touch-action: pan-y; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .axis { fill: var(--text-3); font-size: 11px; font-family: var(--font); }
  .lbl { font-size: 13px; font-weight: 700; font-family: var(--font); }
  .cursor { stroke: var(--text-3); stroke-dasharray: 3 3; }
  figcaption { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; min-height: 1.4em; }
</style>
