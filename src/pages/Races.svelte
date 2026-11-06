<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href } from '../lib/router.svelte';
  import { racePhase, nextRace } from '../domain/season';
  import { flag, formatDay } from '../lib/format';

  const next = $derived(nextRace(app.season, app.snap, app.now));
  const mine = $derived(app.standings.find((s) => s.playerId === app.me));
  const best = (round: number) => Math.max(0, ...app.standings.map((s) => (s.raceScores[round]?.total ?? 0) + (s.sprintScores[round]?.total ?? 0)));

  const rows = $derived(
    app.season.races.map((r) => {
      const phase = racePhase(r, app.snap, app.now);
      const tipped = !!(app.me && app.snap.raceTips[r.round]?.[app.me]);
      const pts = mine ? (mine.raceScores[r.round]?.total ?? null) : null;
      const spts = mine?.sprintScores[r.round]?.total ?? 0;
      return { r, phase, tipped, pts: pts == null ? null : pts + spts, isNext: next?.round === r.round };
    }),
  );

  let list: HTMLElement | undefined = $state();
  $effect(() => {
    // Land on the next race instead of round 1.
    const el = list?.querySelector('.next');
    if (el) el.scrollIntoView({ block: 'center' });
  });
</script>

<div class="page stack">
  <h1 class="title">Kalender {app.season.season}</h1>
  <div class="card flush list" bind:this={list}>
    {#each rows as { r, phase, tipped, pts, isNext } (r.round)}
      <a class="race" class:next={isNext} class:past={phase !== 'open'} href={href(`rennen/${r.round}`)}>
        <span class="rnd num faint">{r.round}</span>
        <span class="flag">{flag(r.countryCode)}</span>
        <span class="grow">
          <strong class="ellipsis">{r.country}{#if r.sprint} <span class="chip sprint s">S</span>{/if}</strong>
          <span class="small faint">{formatDay(r.raceStartUTC)} · {r.city}</span>
        </span>
        {#if phase === 'scored'}
          {#if pts != null}
            <span class="pts num" class:hit={pts > 0 && pts === best(r.round)}>{pts}</span>
          {:else}
            <span class="faint small">–</span>
          {/if}
        {:else if phase === 'locked'}
          <span class="chip">Ergebnis folgt</span>
        {:else if isNext}
          <span class="chip {tipped ? 'good' : 'accent'}">{tipped ? '✓ getippt' : 'Tippen'}</span>
        {:else if tipped}
          <span class="chip good">✓</span>
        {/if}
      </a>
    {/each}
  </div>
  <p class="faint small center">Grüne Punkte: bester Tipper des Wochenendes.</p>
</div>

<style>
  .title { font-size: 26px; font-weight: 900; margin: 4px 2px; }
  .race { display: flex; align-items: center; gap: 12px; padding: 12px 14px; scroll-margin: 120px; }
  .race.next { background: color-mix(in srgb, var(--accent) 9%, transparent); box-shadow: inset 3px 0 0 var(--accent-2); }
  .rnd { width: 20px; text-align: right; font-weight: 700; font-size: 13px; }
  .flag { font-size: 24px; }
  .grow strong { display: block; font-size: 16px; }
  .s { height: 18px; padding: 0 6px; font-size: 10px; vertical-align: 2px; }
  .past .flag { filter: saturate(0.6); }
  .center { text-align: center; }
</style>
