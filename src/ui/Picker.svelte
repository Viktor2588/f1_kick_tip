<script lang="ts">
  import { app } from '../lib/store.svelte';

  let { kind, value, used = {}, optional = false, hint = '', onpick }: {
    kind: 'driver' | 'team';
    value: string | null | undefined;
    /** driverId → label of another slot already holding it (e.g. "P2") */
    used?: Record<string, string>;
    optional?: boolean;
    hint?: string;
    onpick: (id: string | null) => void;
  } = $props();

  let q = $state('');
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  const groups = $derived(
    app.season.teams
      .map((t) => ({
        team: t,
        drivers: t.drivers
          .map((id) => app.driver(id)!)
          .filter(Boolean)
          .filter((d) => !q || norm(d.name).includes(norm(q)) || String(d.number) === q.trim() || norm(t.name).includes(norm(q))),
      }))
      .filter((g) => g.drivers.length),
  );
</script>

{#if hint}<p class="hint muted small">{hint}</p>{/if}

{#if kind === 'driver'}
  <input class="search" type="search" placeholder="Name, Nummer oder Team" bind:value={q} autocomplete="off" enterkeyhint="search" />
  <div class="groups">
    {#each groups as g (g.team.id)}
      <div class="group" style="--tc: {g.team.color}">
        <div class="team tiny">{g.team.name}</div>
        <div class="drivers">
          {#each g.drivers as d (d.id)}
            <button class="opt" class:sel={value === d.id} onclick={() => onpick(d.id)} aria-pressed={value === d.id}>
              <span class="no num">{d.number}</span>
              <span class="nm">{d.name.split(' ').slice(1).join(' ')}</span>
              <span class="fn faint">{d.name.split(' ')[0]}</span>
              {#if used[d.id]}<span class="used">{used[d.id]}</span>{/if}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <p class="empty">Kein Fahrer gefunden.</p>
    {/each}
  </div>
{:else}
  <div class="teams">
    {#each app.season.teams as t (t.id)}
      <button class="opt team-opt" class:sel={value === t.id} style="--tc: {t.color}" onclick={() => onpick(t.id)} aria-pressed={value === t.id}>
        <span class="swatch"></span>
        <span class="nm">{t.name}</span>
        <span class="fn faint">{t.drivers.map((id) => app.lastName(id)).join(' · ')}</span>
      </button>
    {/each}
  </div>
{/if}

{#if optional}
  <button class="btn block ghost none" onclick={() => onpick(null)}>Keinen tippen</button>
{/if}

<style>
  .hint { margin: 0 2px 12px; }
  .search {
    width: 100%; height: 46px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface);
    padding: 0 14px; margin-bottom: 12px; outline: none; font-size: 16px;
  }
  .search:focus { border-color: var(--line-strong); }
  .groups { display: flex; flex-direction: column; gap: 12px; }
  .team { color: var(--text-3); margin: 0 2px 6px; display: flex; align-items: center; gap: 6px; }
  .team::before { content: ''; width: 10px; height: 10px; border-radius: 3px; background: var(--tc); }
  .drivers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .opt {
    position: relative; text-align: left; display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto;
    column-gap: 10px; align-items: center; padding: 10px 12px; min-height: 58px; border-radius: 14px;
    background: var(--surface); border: 1px solid var(--line);
    box-shadow: inset 4px 0 0 var(--tc);
    transition: transform 0.1s, border-color 0.15s, background 0.15s;
  }
  .opt:active { transform: scale(0.97); }
  .opt.sel { border-color: var(--tc); background: color-mix(in srgb, var(--tc) 16%, var(--surface)); }
  .no { grid-row: span 2; font-size: 20px; font-weight: 900; color: color-mix(in srgb, var(--tc) 75%, var(--text)); min-width: 28px; text-align: center; }
  .nm { font-weight: 700; font-size: 16px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fn { font-size: 12px; line-height: 1.1; }
  .used { position: absolute; top: 6px; right: 8px; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: var(--surface-3); color: var(--text-2); }
  .teams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .team-opt { grid-template-columns: auto 1fr; }
  .swatch { grid-row: span 2; width: 22px; height: 22px; border-radius: 7px; background: var(--tc); }
  .none { margin-top: 14px; color: var(--text-2); }
</style>
