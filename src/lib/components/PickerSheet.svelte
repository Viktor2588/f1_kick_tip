<script lang="ts">
  // Bottom sheet for picking a driver or team. Drivers are grouped by team (team colour stripe),
  // with a search field. In multi mode, taps toggle and "Fertig" closes.
  import { season } from '$lib/domain/season';
  import { tick } from 'svelte';

  let {
    open = $bindable(false),
    title,
    kind,
    selected = [],
    disabled = [],
    multiple = false,
    onpick,
    onclear,
  }: {
    open: boolean;
    title: string;
    kind: 'driver' | 'team';
    selected?: string[];
    /** IDs that are already used elsewhere (e.g. other podium slots): shown, but marked. */
    disabled?: string[];
    multiple?: boolean;
    onpick: (id: string) => void;
    onclear?: () => void;
  } = $props();

  let query = $state('');
  let dialog: HTMLDialogElement | undefined = $state();

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  const groups = $derived(
    season.teams
      .map((t) => ({
        team: t,
        drivers: season.drivers.filter((d) => d.team === t.id && (!query || norm(d.name).includes(norm(query)) || norm(t.name).includes(norm(query)) || String(d.number) === query)),
      }))
      .filter((g) => kind === 'team' ? !query || norm(g.team.name).includes(norm(query)) : g.drivers.length > 0),
  );

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      query = '';
      dialog.showModal();
      tick().then(() => dialog?.querySelector<HTMLElement>('.opt.sel, .opt')?.scrollIntoView({ block: 'center' }));
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function pick(id: string) {
    onpick(id);
    if (!multiple) open = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  aria-label={title}
  onclose={() => (open = false)}
  onclick={(e) => { if (e.target === dialog) open = false; }}
>
  <div class="inner">
    <div class="grab" aria-hidden="true"></div>
    <header>
      <h2>{title}</h2>
      <div class="actions">
        {#if onclear && selected.length}
          <button type="button" class="btn btn-sm btn-ghost" onclick={() => { onclear?.(); if (!multiple) open = false; }}>Leeren</button>
        {/if}
        <button type="button" class="btn btn-sm {multiple ? 'btn-primary' : 'btn-ghost'}" onclick={() => (open = false)}>
          {multiple ? 'Fertig' : 'Schließen'}
        </button>
      </div>
    </header>
    <input
      class="search"
      type="search"
      placeholder={kind === 'team' ? 'Team suchen' : 'Fahrer, Team oder Nummer'}
      bind:value={query}
      aria-label="Suchen"
    />
    <div class="list">
      {#each groups as g (g.team.id)}
        {#if kind === 'team'}
          <button type="button" class="opt team" class:sel={selected.includes(g.team.id)} style:--c={g.team.color} onclick={() => pick(g.team.id)}>
            <span class="name">{g.team.name}</span>
            <span class="sub">{g.team.drivers.map((id) => season.drivers.find((d) => d.id === id)?.name.split(' ').slice(-1)[0]).join(' · ')}</span>
            {#if selected.includes(g.team.id)}<span class="check" aria-hidden="true">✓</span>{/if}
          </button>
        {:else}
          <div class="group" style:--c={g.team.color}>
            <div class="team-name">{g.team.name}</div>
            <div class="grid">
              {#each g.drivers as d (d.id)}
                {@const isSel = selected.includes(d.id)}
                {@const isUsed = !isSel && disabled.includes(d.id)}
                <button type="button" class="opt" class:sel={isSel} class:used={isUsed} onclick={() => pick(d.id)} aria-pressed={isSel}>
                  <span class="no num">{d.number}</span>
                  <span class="name">{d.name.split(' ').slice(-1)[0]}</span>
                  <span class="sub">{d.name.split(' ').slice(0, -1).join(' ')}</span>
                  {#if isSel}<span class="check" aria-hidden="true">✓</span>{/if}
                  {#if isUsed}<span class="used-label">schon getippt</span>{/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <p class="empty">Nichts gefunden</p>
      {/each}
    </div>
  </div>
</dialog>

<style>
  .sheet {
    margin: auto 0 0;
    width: 100%;
    max-width: 100%;
    max-height: 88dvh;
    padding: 0;
    border: none;
    border-radius: 22px 22px 0 0;
    background: var(--bg-raised);
    color: var(--text);
    box-shadow: 0 -10px 40px rgb(0 0 0 / 0.4);
  }
  @media (min-width: 720px) {
    .sheet { margin: auto; max-width: 560px; border-radius: 22px; }
  }
  .sheet[open] { animation: up 0.22s cubic-bezier(0.2, 0.9, 0.3, 1); }
  .sheet::backdrop { background: rgb(0 0 0 / 0.55); backdrop-filter: blur(2px); }
  @keyframes up { from { transform: translateY(40px); opacity: 0.4; } }
  .inner { display: flex; flex-direction: column; max-height: 88dvh; padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); }
  .grab { width: 40px; height: 5px; border-radius: 3px; background: var(--line); margin: 2px auto 10px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { font-size: 1.2rem; font-weight: 900; }
  .actions { display: flex; gap: 6px; }
  .search {
    margin: 12px 0 8px;
    width: 100%;
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    padding: 0 14px;
    font: inherit;
  }
  .list { overflow-y: auto; overscroll-behavior: contain; padding-bottom: 8px; }
  .group { margin-top: 12px; }
  .team-name {
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--text-2); display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
  }
  .team-name::before { content: ''; width: 14px; height: 4px; border-radius: 2px; background: var(--c); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .opt {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'no name' 'no sub';
    column-gap: 10px;
    align-items: center;
    text-align: left;
    min-height: 56px;
    padding: 8px 12px 8px 10px;
    border-radius: 12px;
    border: 1px solid var(--line);
    border-left: 4px solid var(--c);
    background: var(--surface);
    cursor: pointer;
    transition: transform 0.08s ease, background 0.15s;
  }
  .opt:active { transform: scale(0.97); }
  .opt.sel { background: var(--accent-soft); border-color: var(--accent); border-left-color: var(--c); }
  .opt.used { opacity: 0.5; }
  .opt.team { width: 100%; margin-top: 8px; grid-template-areas: 'name' 'sub'; grid-template-columns: 1fr; }
  .no { grid-area: no; font-weight: 900; font-size: 1.25rem; color: var(--c); min-width: 2ch; text-align: center; }
  .name { grid-area: name; font-weight: 700; line-height: 1.1; }
  .sub { grid-area: sub; font-size: 0.75rem; color: var(--text-3); line-height: 1.2; }
  .check { position: absolute; top: 6px; right: 10px; color: var(--accent); font-weight: 900; }
  .used-label { position: absolute; bottom: 4px; right: 8px; font-size: 0.65rem; color: var(--text-3); }
</style>
