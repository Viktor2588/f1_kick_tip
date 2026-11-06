<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { Driver, Team } from '$lib/types';

  type Cat = { key: string; label: string; kind: 'driver' | 'team'; required: boolean; group?: 'podium'; hint: string };

  let {
    kind,
    initial,
    drivers,
    teams,
    feedback = null,
  }: {
    kind: 'race' | 'sprint';
    initial: Record<string, string | null> | null;
    drivers: Driver[];
    teams: Team[];
    feedback?: { message?: string; saved?: boolean } | null;
  } = $props();

  const raceCats: Cat[] = [
    { key: 'winner', label: 'P1 · Rennsieger', kind: 'driver', required: true, group: 'podium', hint: '3 Punkte, 1 Punkt wenn er auf P2/P3 landet' },
    { key: 'p2', label: 'P2', kind: 'driver', required: true, group: 'podium', hint: '2 Punkte, 1 Punkt wenn er auf einer anderen Podiumsposition landet' },
    { key: 'p3', label: 'P3', kind: 'driver', required: true, group: 'podium', hint: '2 Punkte, 1 Punkt wenn er auf einer anderen Podiumsposition landet' },
    { key: 'pole', label: 'Pole Position', kind: 'driver', required: false, hint: '3 Punkte' },
    { key: 'fastestLap', label: 'Schnellste Runde', kind: 'driver', required: false, hint: '3 Punkte' },
    { key: 'bestConstructor', label: 'Bester Konstrukteur', kind: 'team', required: false, hint: '3 Punkte · Team mit den meisten Punkten im Rennen' },
    { key: 'dnf', label: 'DNF · Ausfall', kind: 'driver', required: false, hint: '3 Punkte · freiwillig' },
    { key: 'dns', label: 'DNS · Nicht gestartet', kind: 'driver', required: false, hint: '5 Punkte · freiwillig' },
  ];
  const sprintCats: Cat[] = [
    { key: 'winner', label: 'Sprint P1', kind: 'driver', required: true, group: 'podium', hint: '3 Punkte' },
    { key: 'p2', label: 'Sprint P2', kind: 'driver', required: true, group: 'podium', hint: '1 Punkt, 1 Bonus auf anderer Podiumsposition' },
    { key: 'p3', label: 'Sprint P3', kind: 'driver', required: true, group: 'podium', hint: '1 Punkt, 1 Bonus auf anderer Podiumsposition' },
  ];
  const cats = $derived(kind === 'race' ? raceCats : sprintCats);

  let values = $state<Record<string, string>>({});
  let openKey = $state<string | null>(null);
  let saving = $state(false);
  let localError = $state<string | null>(null);

  $effect.pre(() => {
    // (Re)load from the saved tip when it changes (e.g. after saving)
    values = Object.fromEntries((kind === 'race' ? raceCats : sprintCats).map(c => [c.key, initial?.[c.key] ?? '']));
    openKey = initial ? null : 'winner';
  });

  const driverById = $derived(Object.fromEntries(drivers.map(d => [d.id, d])));
  const teamById = $derived(Object.fromEntries(teams.map(t => [t.id, t])));
  const sortedDrivers = $derived(
    [...drivers].sort((a, b) => teams.findIndex(t => t.id === a.teamId) - teams.findIndex(t => t.id === b.teamId)),
  );
  const lastName = (d: Driver) => d.name.split(' ').slice(1).join(' ') || d.name;
  const podiumTaken = (key: string) =>
    Object.fromEntries(cats.filter(c => c.group === 'podium' && c.key !== key && values[c.key]).map(c => [values[c.key], c.label.split(' ')[0] === 'Sprint' ? c.label.replace('Sprint ', '') : c.label.split(' ')[0]]));
  const complete = $derived(cats.filter(c => c.required).every(c => values[c.key]));

  function pick(cat: Cat, id: string) {
    values[cat.key] = values[cat.key] === id && !cat.required ? '' : id;
    if (cat.key === 'dnf' && values.dns === id) values.dns = '';
    if (cat.key === 'dns' && values.dnf === id) values.dnf = '';
    localError = null;
    const next = cats.find(c => c.key !== cat.key && c.required && !values[c.key]);
    openKey = next ? next.key : null;
  }

  function label(cat: Cat) {
    const v = values[cat.key];
    if (!v) return null;
    return cat.kind === 'team' ? teamById[v]?.name ?? v : driverById[v] ? driverById[v].name : v;
  }
  function color(cat: Cat) {
    const v = values[cat.key];
    return cat.kind === 'team' ? teamById[v]?.color : driverById[v] ? teamById[driverById[v].teamId]?.color : undefined;
  }
</script>

<form
  method="POST"
  action="?/{kind}"
  use:enhance={({ cancel }) => {
    if (!complete) {
      // enhance submits regardless of preventDefault, so the client-side check cancels here
      cancel();
      localError = 'Bitte P1, P2 und P3 wählen.';
      openKey = cats.find(c => c.required && !values[c.key])?.key ?? null;
      return;
    }
    saving = true;
    return async ({ result, update }) => {
      saving = false;
      if (result.type === 'success') await invalidateAll();
      await update({ reset: false, invalidateAll: false });
    };
  }}
>
  {#each cats as cat}<input type="hidden" name={cat.key} value={values[cat.key]} />{/each}

  <ul class="cats">
    {#each cats as cat}
      {@const isOpen = openKey === cat.key}
      <li class:open={isOpen}>
        <button type="button" class="cat" aria-expanded={isOpen} onclick={() => (openKey = isOpen ? null : cat.key)}>
          <span class="cat-label">{cat.label}{#if !cat.required}<span class="opt">&nbsp;· optional</span>{/if}</span>
          {#if label(cat)}
            <span class="chosen"><span class="team-bar" style:background={color(cat)}></span>{label(cat)}</span>
          {:else}
            <span class="choose">wählen</span>
          {/if}
        </button>
        {#if isOpen}
          <div class="picker">
            <p class="hint muted small">{cat.hint}</p>
            <div class="chips" class:teams={cat.kind === 'team'}>
              {#if cat.kind === 'team'}
                {#each teams as t}
                  <button type="button" class="chip-btn" class:sel={values[cat.key] === t.id} aria-pressed={values[cat.key] === t.id} style:--tc={t.color} onclick={() => pick(cat, t.id)}>
                    <span class="nm">{t.name}</span>
                  </button>
                {/each}
              {:else}
                {@const taken = cat.group === 'podium' ? podiumTaken(cat.key) : {}}
                {#each sortedDrivers as d}
                  {@const tk = taken[d.id]}
                  <button type="button" class="chip-btn" class:sel={values[cat.key] === d.id} aria-pressed={values[cat.key] === d.id} disabled={!!tk}
                    style:--tc={teamById[d.teamId]?.color} onclick={() => pick(cat, d.id)}>
                    <span class="no tnum">{d.number}</span>
                    <span class="nm">{lastName(d)}</span>
                    <span class="tm">{tk ? `schon ${tk}` : teamById[d.teamId]?.name}</span>
                  </button>
                {/each}
              {/if}
            </div>
            {#if !cat.required && values[cat.key]}
              <button type="button" class="clear small" onclick={() => { values[cat.key] = ''; }}>Auswahl entfernen</button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="actions">
    {#if localError || feedback?.message}
      <p class="msg err" role="alert">{localError ?? feedback?.message}</p>
    {:else if feedback?.saved}
      <p class="msg ok" role="status">✓ Gespeichert. Du kannst bis zum Start noch ändern.</p>
    {/if}
    <button class="btn primary" type="submit" disabled={saving}>{saving ? 'Speichere …' : initial ? 'Tipp aktualisieren' : 'Tipp abgeben'}</button>
  </div>
</form>

<style>
  .cats { list-style: none; display: grid; gap: 6px; }
  .cats > li { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .cats > li.open { border-color: var(--line-strong); }
  .cat { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; padding: 10px 14px; background: none; border: 0; text-align: left; }
  .cat-label { font-weight: 700; }
  .opt { color: var(--text-3); font-weight: 500; font-size: 0.85rem; }
  .chosen { font-weight: 600; text-align: right; }
  .choose { color: var(--accent-text); font-weight: 700; font-size: 0.9rem; }
  .picker { padding: 0 12px 12px; }
  .hint { margin-bottom: 8px; }
  .chips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .chip-btn {
    display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items: center; text-align: left;
    min-height: 52px; padding: 7px 10px 7px 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line);
    border-left: 4px solid var(--tc, var(--line-strong)); min-width: 0;
  }
  .chips.teams .chip-btn { grid-template-columns: 1fr; }
  .chip-btn.sel { background: color-mix(in srgb, var(--tc) 22%, var(--surface-2)); border-color: var(--tc); box-shadow: inset 0 0 0 1px var(--tc); }
  .chip-btn:disabled { opacity: 0.4; }
  .no { grid-row: span 2; font-family: var(--font-display); font-weight: 900; font-size: 1.1rem; color: var(--text-3); min-width: 1.6em; }
  .nm { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tm { font-size: 0.72rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .clear { margin-top: 8px; background: none; border: 0; color: var(--text-3); text-decoration: underline; }
  .actions {
    position: sticky; bottom: calc(var(--nav-h) + var(--safe-b) + 8px); z-index: 5; margin-top: 12px;
    display: grid; gap: 8px; padding: 10px; border-radius: 16px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px);
  }
  .actions .btn { width: 100%; }
  .msg { font-weight: 600; font-size: 0.9rem; }
  .err { color: var(--bad); }
  .ok { color: var(--good); }
  @media (min-width: 640px) { .chips { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 1024px) {
    .chips { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .actions { bottom: 12px; }
    .actions .btn { width: auto; justify-self: start; }
  }
</style>
