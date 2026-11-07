<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import DriverTag from '$lib/components/DriverTag.svelte';
  import TipEditor from '$lib/components/TipEditor.svelte';
  import { season, playerById } from '$lib/domain/season';
  import { deadlineOf, isOpen } from '$lib/domain/schedule';
  import { isHidden } from '$lib/domain/types';
  import { POINTS, scoreSeason } from '$lib/domain/scoring';
  import { clock } from '$lib/clock.svelte';

  let { data, form } = $props();
  const deadline = deadlineOf(season, 'season')!;
  const open = $derived(isOpen(deadline, new Date(clock.now)));
  const mine = $derived.by(() => {
    const t = data.viewer ? data.game.seasonTips[data.viewer] : undefined;
    return t && !isHidden(t) ? t : undefined;
  });
</script>

<svelte:head><title>Saison-Tipps · F1 Kick Tip</title></svelte:head>

<main class="page">
  <h1 class="page-title">Saison-Tipps</h1>
  <p class="page-sub">
    Weltmeister ({POINTS.season.wdc} Pkt) und Konstrukteurs-Weltmeister ({POINTS.season.wcc} Pkt).
    {open ? 'Offen bis zum Start von Runde 1.' : 'Seit Runde 1 gesperrt, Auflösung am Saisonende.'}
  </p>

  {#if open && data.viewer}
    <TipEditor
      action="?"
      slots={[
        { name: 'wdc', label: 'Fahrer-Weltmeister', badge: '👑', kind: 'driver', points: `${POINTS.season.wdc}` },
        { name: 'wcc', label: 'Konstrukteurs-WM', badge: '🏭', kind: 'team', points: `${POINTS.season.wcc}` },
      ]}
      initial={{ wdc: mine?.wdc ?? null, wcc: mine?.wcc ?? null }}
      hasExisting={!!mine}
      {deadline}
      submitLabel="Saison-Tipp abgeben"
      serverError={form?.error ?? null}
    />
  {/if}

  {#if season.final}
    <section class="section">
      <h2 class="section-title">Auflösung</h2>
      <div class="card final">
        <div><span class="small faint">Weltmeister</span><DriverTag id={season.final.wdc} full /></div>
        <div><span class="small faint">Konstrukteure</span><DriverTag id={season.final.wcc} kind="team" /></div>
      </div>
    </section>
  {/if}

  <section class="section">
    <h2 class="section-title">Alle Tipps</h2>
    <ul class="list">
      {#each season.players as p (p.id)}
        {@const t = data.game.seasonTips[p.id]}
        <li class="card">
          <Avatar id={p.id} size={36} />
          <b class="nm">{playerById(p.id)?.name}</b>
          {#if !t}
            <span class="faint">kein Tipp</span>
          {:else if isHidden(t)}
            <span class="faint">🔒 abgegeben</span>
          {:else}
            {@const sc = scoreSeason(t, season.final)}
            <span class="picks">
              <span class:hit={sc.breakdown.wdc > 0}><DriverTag id={t.wdc} full /></span>
              <span class:hit={sc.breakdown.wcc > 0}><DriverTag id={t.wcc} kind="team" /></span>
            </span>
            {#if season.final}<b class="num pts">+{sc.total}</b>{/if}
          {/if}
        </li>
      {/each}
    </ul>
  </section>
</main>

<style>
  .final { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .final div { display: flex; flex-direction: column; gap: 4px; }
  .list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .list li { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .nm { width: 70px; }
  .picks { flex: 1; display: flex; flex-direction: column; gap: 2px; align-items: flex-end; }
  .hit { background: var(--good-soft); border-radius: 6px; padding: 0 6px; }
  .pts { font-size: 1.2rem; }
</style>
