<script lang="ts">
  import TipEditor from '$lib/components/TipEditor.svelte';
  import TipMatrix from '$lib/components/TipMatrix.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import type { SlotDef, SlotValues } from '$lib/components/SlotForm.svelte';
  import { season, flag, raceByRound } from '$lib/domain/season';
  import { dnfDnsActive, isOpen, nextRace, weekendStatus } from '$lib/domain/schedule';
  import { isHidden, type RaceTip, type SprintTip } from '$lib/domain/types';
  import { POINTS } from '$lib/domain/scoring';
  import { raceMatrix, sprintMatrix } from '$lib/matrix';
  import { clock } from '$lib/clock.svelte';
  import { fmtDayTime, fmtStamp } from '$lib/format';

  let { data, form } = $props();

  const race = $derived(raceByRound(data.round)!);
  const key = $derived(String(race.round));
  const now = $derived(new Date(clock.now));
  const status = $derived(weekendStatus(race, data.game, now, nextRace(season, now)));
  const raceOpen = $derived(isOpen(race.raceStartUTC, now));
  const sprintOpen = $derived(race.sprint && isOpen(race.sprintStartUTC, now));
  const withDnf = $derived(dnfDnsActive(season, race.round));

  const P = POINTS.race;
  const raceSlots = $derived<SlotDef[]>([
    { name: 'p1', label: 'Rennsieger', badge: 'P1', kind: 'driver', group: 'podium', points: `${P.winner}` },
    { name: 'p2', label: 'Zweiter', badge: 'P2', kind: 'driver', group: 'podium', points: `${P.p2}` },
    { name: 'p3', label: 'Dritter', badge: 'P3', kind: 'driver', group: 'podium', points: `${P.p3}` },
    { name: 'pole', label: 'Pole Position', badge: '⏱', kind: 'driver', hint: 'Schnellster im Qualifying', points: `${P.pole}` },
    { name: 'fastestLap', label: 'Schnellste Runde', badge: '⚡', kind: 'driver', points: `${P.fastestLap}` },
    { name: 'bestConstructor', label: 'Bester Konstrukteur', badge: '🏭', kind: 'team', hint: 'Meiste Punkte im Rennen', points: `${P.bestConstructor}` },
    ...(withDnf
      ? ([
          { name: 'dnf', label: 'Ausfall (DNF)', badge: '💥', kind: 'driver', hint: 'Startet, kommt nicht ins Ziel', points: `${P.dnf}` },
          { name: 'dns', label: 'Nicht gestartet (DNS)', badge: '🚫', kind: 'driver', hint: 'Freiwillig', points: `${P.dns}` },
        ] as SlotDef[])
      : []),
  ]);
  const sprintSlots: SlotDef[] = [
    { name: 'p1', label: 'Sprint-Sieger', badge: 'P1', kind: 'driver', group: 'podium', points: `${POINTS.sprint.winner}` },
    { name: 'p2', label: 'Zweiter', badge: 'P2', kind: 'driver', group: 'podium', points: `${POINTS.sprint.p2}` },
    { name: 'p3', label: 'Dritter', badge: 'P3', kind: 'driver', group: 'podium', points: `${POINTS.sprint.p3}` },
  ];

  const raceValues = (t: RaceTip | undefined): SlotValues => ({
    p1: t?.podium[0] ?? null, p2: t?.podium[1] ?? null, p3: t?.podium[2] ?? null,
    pole: t?.pole ?? null, fastestLap: t?.fastestLap ?? null, bestConstructor: t?.bestConstructor ?? null,
    dnf: t?.dnf ?? null, dns: t?.dns ?? null,
  });
  const sprintValues = (t: SprintTip | undefined): SlotValues => ({ p1: t?.podium[0] ?? null, p2: t?.podium[1] ?? null, p3: t?.podium[2] ?? null });

  const myRace = $derived.by(() => {
    const t = data.viewer ? data.game.raceTips[key]?.[data.viewer] : undefined;
    return t && !isHidden(t) ? t : undefined;
  });
  const mySprint = $derived.by(() => {
    const t = data.viewer ? data.game.sprintTips[key]?.[data.viewer] : undefined;
    return t && !isHidden(t) ? t : undefined;
  });
  /** My most recent earlier race tip, to copy with one tap. */
  const previous = $derived.by(() => {
    if (!data.viewer) return null;
    for (let r = race.round - 1; r >= 1; r--) {
      const t = data.game.raceTips[String(r)]?.[data.viewer];
      if (t && !isHidden(t)) return { round: r, values: raceValues(t) };
    }
    return null;
  });

  const rm = $derived(raceMatrix(season, race, data.game));
  const sm = $derived(race.sprint ? sprintMatrix(season, race, data.game) : null);
  const result = $derived(data.game.raceResults[key]);
  const statusLabel = { upcoming: 'Offen', open: 'Nächstes Rennen', live: 'Läuft gerade', awaiting: 'Ergebnis folgt', finished: 'Ausgewertet' };
  const prev = $derived(raceByRound(race.round - 1));
  const next = $derived(raceByRound(race.round + 1));
</script>

<svelte:head><title>{race.country} · Runde {race.round} · F1 Kick Tip</title></svelte:head>

<main class="page">
  <nav class="crumbs small">
    <a href="/rennen">← Kalender</a>
    <span class="pn">
      {#if prev}<a href="/rennen/{prev.round}" aria-label="Vorherige Runde">‹ R{prev.round}</a>{/if}
      {#if next}<a href="/rennen/{next.round}" aria-label="Nächste Runde">R{next.round} ›</a>{/if}
    </span>
  </nav>

  <header class="head">
    <div class="chips">
      <span class="chip">Runde {race.round}</span>
      <span class="chip" class:chip-accent={status === 'open' || status === 'live'} class:chip-good={status === 'finished'}>{statusLabel[status]}</span>
      {#if race.sprint}<span class="chip">Sprint</span>{/if}
    </div>
    <h1 class="page-title"><span aria-hidden="true">{flag(race.countryCode)}</span> {race.country}</h1>
    <p class="page-sub">{race.name} · {race.circuit}</p>
    <ul class="sessions card small">
      <li><span>Qualifying</span><b>{fmtDayTime(race.qualiStartUTC)}</b></li>
      {#if race.sprint && race.sprintStartUTC}<li><span>Sprint</span><b>{fmtDayTime(race.sprintStartUTC)}</b></li>{/if}
      <li><span>Rennen</span><b>{fmtDayTime(race.raceStartUTC)}</b></li>
    </ul>
  </header>

  {#if sprintOpen}
    <section class="section" id="sprint">
      <h2 class="section-title">Dein Sprint-Tipp</h2>
      {#if data.viewer}
        <TipEditor
          action="?/sprint"
          slots={sprintSlots}
          initial={sprintValues(mySprint)}
          hasExisting={!!mySprint}
          deadline={race.sprintStartUTC!}
          submitLabel="Sprint-Tipp abgeben"
          serverError={form?.kind === 'sprint' ? (form?.error ?? null) : null}
        />
      {:else}
        <a class="btn btn-primary btn-block" href="/login?next=/rennen/{race.round}">Anmelden zum Tippen</a>
      {/if}
    </section>
  {/if}

  {#if raceOpen}
    <section class="section" id="tipp">
      <h2 class="section-title">Dein Renntipp</h2>
      {#if !sprintOpen}
        <div class="cd"><Countdown to={race.raceStartUTC} /></div>
      {/if}
      {#if data.viewer}
        {#key race.round}
          <TipEditor
            action="?/race"
            slots={raceSlots}
            initial={raceValues(myRace)}
            hasExisting={!!myRace}
            deadline={race.raceStartUTC}
            copyFrom={previous?.values ?? null}
            copyLabel="Tipp aus Runde {previous?.round} übernehmen"
            serverError={form?.kind === 'race' ? (form?.error ?? null) : null}
          />
        {/key}
      {:else}
        <a class="btn btn-primary btn-block" href="/login?next=/rennen/{race.round}">Anmelden zum Tippen</a>
      {/if}
    </section>
  {/if}

  <section class="section">
    <h2 class="section-title">
      {result ? 'Rennen: Tipps & Punkte' : 'Renntipps'}
      {#if result}<span class="faint small">eingetragen {fmtStamp(result.enteredAt)}</span>{/if}
    </h2>
    {#if rm.anyTips}
      <TipMatrix matrix={rm} viewer={data.viewer} bonusLabel=" (+{POINTS.race.podiumBonus})" />
      {#if result?.dnf && (result.dnf.length || result.dns?.length)}
        <p class="small muted note">Perfekte Runde (+{POINTS.race.perfect}) ist in der Summe enthalten. DNF/DNS zählen nicht dazu.</p>
      {/if}
    {:else}
      <p class="card empty">Noch keine Tipps für dieses Rennen.</p>
    {/if}
  </section>

  {#if sm && (sm.anyTips || data.game.sprintResults[key])}
    <section class="section">
      <h2 class="section-title">Sprint: Tipps & Punkte</h2>
      {#if sm.anyTips}
        <TipMatrix matrix={sm} viewer={data.viewer} bonusLabel=" (+{POINTS.sprint.podiumBonus})" />
      {:else}
        <p class="card empty">Keine Sprint-Tipps.</p>
      {/if}
    </section>
  {/if}
</main>

<style>
  .crumbs { display: flex; justify-content: space-between; padding: 8px 0; }
  .crumbs a { color: var(--text-2); text-decoration: none; font-weight: 600; }
  .pn { display: flex; gap: 14px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .sessions { list-style: none; margin: 0; padding: 6px 14px; }
  .sessions li { display: flex; justify-content: space-between; padding: 6px 0; }
  .sessions li + li { border-top: 1px solid var(--line); }
  .sessions span { color: var(--text-2); }
  .cd { margin-bottom: 12px; color: var(--text); }
  .cd :global(.u) { background: var(--surface-2); }
  .note { margin: 8px 4px 0; }
  section[id] { scroll-margin-top: 12px; }
</style>
