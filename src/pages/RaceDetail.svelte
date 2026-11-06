<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href, router } from '../lib/router.svelte';
  import { raceSlotsFor, SPRINT_SLOTS, type RaceSlot } from '../domain/rules';
  import { racePhase, sprintPhase } from '../domain/season';
  import { scoreRace, scoreSprint, isLate } from '../domain/scoring';
  import { flag, formatDayTime } from '../lib/format';
  import Avatar from '../ui/Avatar.svelte';
  import DriverTag from '../ui/DriverTag.svelte';

  let { round }: { round: number } = $props();

  const race = $derived(app.race(round));
  let view = $state<'race' | 'sprint'>('race');
  const isSprint = $derived(view === 'sprint' && !!race?.sprint);

  const phase = $derived(race ? (isSprint ? sprintPhase(race, app.snap, app.now) : racePhase(race, app.snap, app.now)) : null);
  const revealed = $derived(phase !== 'open');
  const slots = $derived(isSprint ? SPRINT_SLOTS : raceSlotsFor(round));
  const tips = $derived((isSprint ? app.snap.sprintTips[round] : app.snap.raceTips[round]) ?? {});
  const result = $derived(isSprint ? app.snap.sprintResults[round] : app.snap.raceResults[round]);
  const deadline = $derived(race ? (isSprint ? race.sprintStartUTC : race.raceStartUTC) : null);
  const players = $derived(app.standings.map((s) => s.playerId));

  const score = (pid: string) => {
    if (!race || !result) return null;
    const t = tips[pid];
    if (!t) return null;
    return isSprint ? scoreSprint(t as any, result as any, race) : scoreRace(t as any, result as any, race);
  };

  function cellState(key: RaceSlot, value: string | null | undefined): 'hit' | 'part' | 'miss' | null {
    if (!result || !value) return null;
    const r = result as unknown as Record<string, unknown>;
    if (key === 'p1' || key === 'p2' || key === 'p3') {
      if (r[key] === value) return 'hit';
      return [r.p1, r.p2, r.p3].includes(value) ? 'part' : 'miss';
    }
    if (key === 'dnf' || key === 'dns') {
      if (!Array.isArray(r[key])) return null;
      return (r[key] as string[]).includes(value) ? 'hit' : 'miss';
    }
    return r[key] === value ? 'hit' : 'miss';
  }

  const resultValue = (key: RaceSlot): string[] => {
    const r = result as unknown as Record<string, unknown> | undefined;
    if (!r) return [];
    const v = r[key];
    return Array.isArray(v) ? v : v ? [String(v)] : [];
  };
</script>

{#if !race}
  <div class="page"><div class="card empty">Runde nicht gefunden.</div></div>
{:else}
  <div class="page stack">
    <header class="head">
      <button class="back" onclick={() => router.back('rennen')} aria-label="Zurück">‹</button>
      <div class="grow">
        <div class="tiny faint">Runde {race.round} · {race.city}</div>
        <h1>{flag(race.countryCode)} {race.name.replace('Großer Preis', 'GP')}</h1>
      </div>
    </header>

    <div class="card times small">
      {#if race.sprintStartUTC}<div><span class="faint">Sprint</span> {formatDayTime(race.sprintStartUTC)}</div>{/if}
      {#if race.qualiStartUTC}<div><span class="faint">Quali</span> {formatDayTime(race.qualiStartUTC)}</div>{/if}
      <div><span class="faint">Rennen</span> <strong>{formatDayTime(race.raceStartUTC)}</strong></div>
      <div class="faint">{race.circuit}</div>
    </div>

    {#if race.sprint}
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={view === 'race'} class:on={view === 'race'} onclick={() => (view = 'race')}>Rennen</button>
        <button role="tab" aria-selected={view === 'sprint'} class:on={view === 'sprint'} onclick={() => (view = 'sprint')}>Sprint</button>
      </div>
    {/if}

    {#if phase === 'open'}
      <a class="btn primary block" href={href(isSprint ? `tipp/${round}/sprint` : `tipp/${round}`)}>
        {app.me && tips[app.me] ? 'Meinen Tipp ändern' : 'Jetzt tippen'}
      </a>
    {/if}

    <div class="section-title">
      {result ? 'Ergebnis & Tipps' : revealed ? 'Tipps · Ergebnis folgt' : 'Tipps · verdeckt bis Start'}
    </div>

    <div class="card flush grid-wrap">
      <table class="grid">
        <thead>
          <tr>
            <th></th>
            {#if result}<th class="res-h tiny faint">Ergebnis</th>{/if}
            {#each players as pid (pid)}
              <th><Avatar id={pid} size={30} ring={pid === app.me} /></th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each slots as s (s.key)}
            <tr>
              <th class="cat tiny faint" scope="row">{s.short}</th>
              {#if result}
                <td class="res-c">
                  {#each resultValue(s.key) as v}<div><DriverTag id={v} kind={s.kind} code /></div>{:else}<span class="faint">–</span>{/each}
                </td>
              {/if}
              {#each players as pid (pid)}
                {@const t = tips[pid] as unknown as Record<string, string | null> | undefined}
                <td>
                  {#if !t}
                    <span class="faint">–</span>
                  {:else if !revealed && pid !== app.me}
                    <span class="hidden" aria-label="verdeckt">●●●</span>
                  {:else}
                    <DriverTag id={t[s.key]} kind={s.kind} code state={cellState(s.key, t[s.key])} />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <th class="cat tiny faint" scope="row">Pkt</th>
            {#if result}<td></td>{/if}
            {#each players as pid (pid)}
              {@const sc = score(pid)}
              <td>
                {#if sc}
                  <span class="total num" class:perfect={sc.perfect}>{sc.total}</span>
                  {#if sc.late}<span class="chip warn">zu spät</span>{/if}
                  {#if sc.perfect}<span class="chip good">Perfekt</span>{/if}
                {:else if tips[pid]}
                  <span class="chip good">✓ getippt</span>
                {:else}
                  <span class="faint small">kein Tipp</span>
                {/if}
              </td>
            {/each}
          </tr>
        </tfoot>
      </table>
    </div>

    {#if result}
      <p class="faint small legend">
        <span class="lg hit">grün</span> exakt · <span class="lg part">gelb</span> auf dem Podium, andere Position · durchgestrichen daneben
      </p>
    {/if}
    {#if !revealed}
      <p class="faint small legend">Die Tipps der anderen werden beim {isSprint ? 'Sprintstart' : 'Rennstart'} aufgedeckt. Deinen eigenen siehst nur du.</p>
    {/if}
    {#each players as pid (pid)}
      {@const t = tips[pid]}
      {#if t && deadline && isLate(t.submittedAt, deadline) && revealed}
        <p class="faint small legend">{app.playerById(pid)?.name}s Tipp kam nach dem Start ({formatDayTime(t.submittedAt)}) und zählt nicht.</p>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .head { display: flex; align-items: center; gap: 10px; }
  .back { width: 40px; height: 40px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); font-size: 26px; line-height: 1; padding-bottom: 3px; }
  h1 { font-size: 23px; font-weight: 900; line-height: 1.1; }
  .times { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 4px; }
  .seg button { height: 38px; border-radius: 10px; font-weight: 700; color: var(--text-2); }
  .seg .on { background: var(--surface-3); color: var(--text); }
  .grid-wrap { overflow-x: auto; }
  .grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 15px; }
  .grid th, .grid td { padding: 10px 8px; text-align: left; vertical-align: middle; border-bottom: 1px solid var(--line); overflow: hidden; }
  .grid thead th { text-align: left; padding-top: 12px; }
  .grid .cat { width: 42px; padding-left: 12px; }
  .res-h, .res-c { background: var(--surface-2); }
  .res-c div + div { margin-top: 2px; }
  tfoot td, tfoot th { border-bottom: 0; padding-bottom: 12px; }
  .total { font-size: 22px; font-weight: 900; display: block; line-height: 1.1; }
  .total.perfect { color: var(--good); }
  tfoot .chip { margin-top: 4px; height: 22px; font-size: 11px; padding: 0 7px; }
  .hidden { color: var(--text-3); letter-spacing: 2px; font-size: 10px; }
  .legend { padding: 0 4px; }
  .lg.hit { color: var(--good); font-weight: 700; }
  .lg.part { color: var(--warn); font-weight: 700; }
</style>
