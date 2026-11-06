<script lang="ts">
  import { app } from '../lib/store.svelte';
  import type { PlayerStanding } from '../domain/standings';
  import { flag } from '../lib/format';

  let { standings }: { standings: PlayerStanding[] } = $props();

  const W = 360, H = 210, L = 30, R = 64, T = 12, B = 24;
  const n = $derived(standings[0]?.perRound.length ?? 0);
  const maxY = $derived(Math.max(10, ...standings.map((s) => s.perRound.at(-1)?.cumulative ?? 0)));
  const niceMax = $derived(Math.ceil(maxY / 50) * 50);
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B);
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f)));

  const lines = $derived(
    standings.map((s) => ({
      id: s.playerId,
      color: app.playerById(s.playerId)?.color ?? '#888',
      d: s.perRound.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cumulative).toFixed(1)}`).join(''),
      last: s.perRound.at(-1)?.cumulative ?? 0,
    })),
  );

  // Spread end labels so they don't overlap.
  const labels = $derived.by(() => {
    const sorted = [...lines].sort((a, b) => b.last - a.last).map((l) => ({ ...l, ly: y(l.last) }));
    for (let i = 1; i < sorted.length; i++) if (sorted[i].ly - sorted[i - 1].ly < 15) sorted[i].ly = sorted[i - 1].ly + 15;
    return sorted;
  });

  let svg: SVGSVGElement | undefined = $state();
  let hover = $state<number | null>(null);
  function onMove(e: PointerEvent) {
    if (!svg || n < 1) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    hover = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
  }
  const hoverRace = $derived(hover != null ? app.race(standings[0].perRound[hover].round) : null);
</script>

{#if n < 2}
  <div class="empty small">Der Verlauf erscheint nach dem zweiten Rennen.</div>
{:else}
  <div class="wrap">
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="Punkteverlauf über die Saison"
      onpointermove={onMove}
      onpointerdown={onMove}
      onpointerleave={() => (hover = null)}
    >
      {#each ticks as t}
        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="grid" />
        <text x={L - 6} y={y(t) + 4} class="axis" text-anchor="end">{t}</text>
      {/each}
      {#each [0, Math.floor((n - 1) / 2), n - 1] as i}
        <text x={x(i)} y={H - 6} class="axis" text-anchor="middle">R{standings[0].perRound[i].round}</text>
      {/each}
      {#each lines as l (l.id)}
        <path d={l.d} stroke={l.color} class="line" class:me={l.id === app.me} />
      {/each}
      {#each labels as l (l.id)}
        <circle cx={x(n - 1)} cy={y(l.last)} r="3.5" fill={l.color} />
        <text x={x(n - 1) + 8} y={l.ly + 4} class="end" fill={l.color}>{app.playerById(l.id)?.name} {l.last}</text>
      {/each}
      {#if hover != null}
        <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} class="cursor" />
        {#each standings as s (s.playerId)}
          <circle cx={x(hover)} cy={y(s.perRound[hover].cumulative)} r="4.5" fill={app.playerById(s.playerId)?.color} class="dot" />
        {/each}
      {/if}
    </svg>
    <div class="tip small" class:show={hover != null}>
      {#if hover != null && hoverRace}
        <strong>{flag(hoverRace.countryCode)} R{hoverRace.round} {hoverRace.country}</strong>
        {#each [...standings].sort((a, b) => b.perRound[hover!].cumulative - a.perRound[hover!].cumulative) as s (s.playerId)}
          <span style="color: {app.playerById(s.playerId)?.color}">{app.playerById(s.playerId)?.name} {s.perRound[hover].cumulative} <span class="faint">(+{s.perRound[hover].points})</span></span>
        {/each}
      {:else}
        <span class="faint">Finger aufs Diagramm legen für Details</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .wrap { position: relative; }
  svg { width: 100%; height: auto; display: block; touch-action: pan-y; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .axis { fill: var(--text-3); font-size: 10px; font-weight: 600; }
  .line { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; opacity: 0.85; }
  .line.me { stroke-width: 3.4; opacity: 1; }
  .end { font-size: 11px; font-weight: 800; }
  .cursor { stroke: var(--text-3); stroke-dasharray: 3 3; }
  .dot { stroke: var(--surface); stroke-width: 2; }
  .tip { display: flex; flex-wrap: wrap; gap: 4px 12px; min-height: 40px; padding: 8px 2px 0; }
  .tip strong { width: 100%; }
</style>
