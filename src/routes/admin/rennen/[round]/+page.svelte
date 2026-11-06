<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { flag } from '$lib/race';
  import { scoreRace, scoreSprint, type RaceTip, type SprintTip } from '$lib/scoring';
  import type { Driver, Team, Player } from '$lib/types';

  let { data, form } = $props();
  const drivers = $derived(Object.values(data.meta.drivers) as Driver[]);
  const teams = $derived(Object.values(data.meta.teams) as Team[]);
  const players = $derived(data.meta.players as Player[]);
  const teamOf = (id: string) => data.meta.teams[data.meta.drivers[id]?.teamId];
  const lastName = (d: Driver) => d.name.split(' ').slice(1).join(' ') || d.name;

  let r = $state({ winner: '', p2: '', p3: '', pole: '', fastestLap: '', bestConstructor: '', dnf: [] as string[], dns: [] as string[] });
  let s = $state({ winner: '', p2: '', p3: '' });
  $effect.pre(() => {
    const res = data.result;
    r = {
      winner: res?.winner ?? '', p2: res?.podium?.[1] ?? '', p3: res?.podium?.[2] ?? '', pole: res?.pole ?? '', fastestLap: res?.fastestLap ?? '',
      bestConstructor: res?.bestConstructor ?? '', dnf: [...(res?.dnf ?? [])], dns: [...(res?.dns ?? [])],
    };
    const sr = data.sprintResult;
    s = { winner: sr?.winner ?? '', p2: sr?.podium?.[1] ?? '', p3: sr?.podium?.[2] ?? '' };
  });

  function toggle(list: 'dnf' | 'dns', id: string) {
    const other = list === 'dnf' ? 'dns' : 'dnf';
    r[list] = r[list].includes(id) ? r[list].filter(x => x !== id) : [...r[list], id];
    r[other] = r[other].filter(x => x !== id);
  }

  const resultObj = $derived({
    winner: r.winner, podium: [r.winner, r.p2, r.p3], pole: r.pole, fastestLap: r.fastestLap, bestConstructor: r.bestConstructor,
    ...(data.withLists ? { dnf: r.dnf, dns: r.dns } : {}),
  });
  const preview = $derived(
    players.map(p => {
      const tip = (data.tips as Record<string, RaceTip>)[p.id];
      const sTip = (data.sprintTips as Record<string, SprintTip>)[p.id];
      const race = tip && r.winner ? scoreRace(tip, resultObj, data.race) : null;
      const sprint = sTip && s.winner ? scoreSprint(sTip, { winner: s.winner, podium: [s.winner, s.p2, s.p3] }, data.race) : null;
      return { p, race, sprint, hasTip: !!tip };
    }),
  );

  const singles = [
    ['winner', 'P1 · Sieger'], ['p2', 'P2'], ['p3', 'P3'], ['pole', 'Pole Position'], ['fastestLap', 'Schnellste Runde'],
  ] as const;
  const after = () => async ({ result, update }: { result: { type: string }; update: (o?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void> }) => {
    if (result.type === 'success') await invalidateAll();
    await update({ reset: false, invalidateAll: false });
  };
</script>

<svelte:head><title>Ergebnis Runde {data.race.round} – Admin</title></svelte:head>

<a href="/admin" class="back small">← Admin</a>
<h1>{flag(data.race.countryCode)} {data.race.name}</h1>
<p class="muted small">Runde {data.race.round} · Ergebnis {data.result ? 'bearbeiten' : 'eintragen'}</p>

<div class="layout">
  <form method="POST" action="?/race" use:enhance={after} class="card entry">
    <h2>Rennergebnis</h2>
    {#each singles as [key, label]}
      <label>{label}
        <select name={key} bind:value={r[key]}>
          <option value="">– wählen –</option>
          {#each drivers as d}<option value={d.id}>{d.name} (#{d.number})</option>{/each}
        </select>
      </label>
    {/each}
    <label>Bester Konstrukteur
      <select name="bestConstructor" bind:value={r.bestConstructor}>
        <option value="">– wählen –</option>
        {#each teams as t}<option value={t.id}>{t.name}</option>{/each}
      </select>
    </label>

    {#if data.withLists}
      {#each [['dnf', 'DNF · gestartet, nicht im Ziel'], ['dns', 'DNS · nicht gestartet']] as [list, label]}
        <fieldset>
          <legend>{label} <span class="muted">({r[list as 'dnf' | 'dns'].length})</span></legend>
          <div class="toggles">
            {#each drivers as d}
              {@const on = r[list as 'dnf' | 'dns'].includes(d.id)}
              <button type="button" class="tg" class:on aria-pressed={on} style:--tc={teamOf(d.id)?.color} onclick={() => toggle(list as 'dnf' | 'dns', d.id)}>{lastName(d)}</button>
            {/each}
          </div>
          {#each r[list as 'dnf' | 'dns'] as id}<input type="hidden" name={list} value={id} />{/each}
        </fieldset>
      {/each}
    {:else}
      <p class="muted small">DNF/DNS gibt es erst ab Runde 16.</p>
    {/if}

    {#if form?.form === 'race' && form?.message}<p class="err" role="alert">{form.message}</p>{/if}
    {#if form?.form === 'race' && form?.saved}<p class="ok" role="status">✓ Ergebnis gespeichert. Tabelle ist aktualisiert.</p>{/if}
    {#if form?.form === 'race' && form?.deleted}<p class="ok" role="status">Ergebnis gelöscht.</p>{/if}
    <div class="row">
      <button class="btn primary" type="submit">Ergebnis speichern</button>
      {#if data.result}
        <button class="btn ghost" type="submit" formaction="?/deleteRace" onclick={e => { if (!confirm('Ergebnis wirklich löschen?')) e.preventDefault(); }}>Löschen</button>
      {/if}
    </div>
  </form>

  <div class="side">
    <section class="card">
      <h2>Vorschau Punkte</h2>
      {#if !data.raceStarted}
        <p class="muted small">Die Tipps der anderen sind erst ab Rennstart sichtbar.</p>
      {/if}
      <ul class="preview">
        {#each preview as row}
          <li style:--pc={row.p.color}>
            <span>{row.p.emoji} {row.p.name}</span>
            {#if !row.hasTip}<span class="muted small">kein Tipp</span>
            {:else if row.race?.late}<span class="chip late">Verspätet</span>
            {:else if row.race}<strong class="tnum">{row.race.total + (row.sprint?.total ?? 0)} Pkt.</strong>
            {:else}<span class="muted small">Ergebnis fehlt</span>{/if}
          </li>
        {/each}
      </ul>
    </section>

    {#if data.race.sprint}
      <form method="POST" action="?/sprint" use:enhance={after} class="card entry">
        <h2>Sprint-Ergebnis</h2>
        {#each [['winner', 'Sprint P1'], ['p2', 'Sprint P2'], ['p3', 'Sprint P3']] as [key, label]}
          <label>{label}
            <select name={key} bind:value={s[key as 'winner' | 'p2' | 'p3']}>
              <option value="">– wählen –</option>
              {#each drivers as d}<option value={d.id}>{d.name}</option>{/each}
            </select>
          </label>
        {/each}
        {#if form?.form === 'sprint' && form?.message}<p class="err" role="alert">{form.message}</p>{/if}
        {#if form?.form === 'sprint' && form?.saved}<p class="ok" role="status">✓ Sprint gespeichert.</p>{/if}
        <div class="row">
          <button class="btn primary" type="submit">Sprint speichern</button>
          {#if data.sprintResult}
            <button class="btn ghost" type="submit" formaction="?/deleteSprint" onclick={e => { if (!confirm('Sprint-Ergebnis wirklich löschen?')) e.preventDefault(); }}>Löschen</button>
          {/if}
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .back { color: var(--accent-text); font-weight: 600; }
  h1 { margin: 6px 0 2px; }
  .layout { display: grid; gap: 12px; margin-top: 16px; }
  .side { display: grid; gap: 12px; align-content: start; }
  .entry { display: grid; gap: 10px; }
  label, legend { display: grid; gap: 4px; font-size: 0.85rem; font-weight: 600; color: var(--text-2); }
  select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--text); font: inherit; font-size: 16px; }
  fieldset { border: 0; display: grid; gap: 6px; }
  .toggles { display: flex; flex-wrap: wrap; gap: 6px; }
  .tg { min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-strong); border-left: 4px solid var(--tc); background: var(--surface-2); font-size: 0.85rem; font-weight: 600; }
  .tg.on { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .preview { list-style: none; }
  .preview li { display: flex; justify-content: space-between; align-items: center; padding: 10px 0 10px 10px; border-top: 1px solid var(--line); border-left: 3px solid var(--pc); }
  .preview li:first-child { border-top: 0; }
  .ok { color: var(--good); font-weight: 600; }
  .err { color: var(--bad); font-weight: 600; }
  @media (min-width: 900px) { .layout { grid-template-columns: 1.3fr 1fr; align-items: start; } }
</style>
