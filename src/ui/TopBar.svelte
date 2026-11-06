<script lang="ts">
  import { app } from '../lib/store.svelte';
  import Avatar from './Avatar.svelte';
  import Sheet from './Sheet.svelte';
  import { LATEST_UPDATE } from '../updates';
  import { completedRounds } from '../domain/season';

  let { onswitch }: { onswitch: () => void } = $props();

  const KEY = 'f1_seen_update';
  let seen = $state(read());
  let showUpdate = $state(false);
  function read() { try { return localStorage.getItem(KEY); } catch { return null; } }
  function openUpdate() {
    showUpdate = true;
    seen = LATEST_UPDATE.id;
    try { localStorage.setItem(KEY, LATEST_UPDATE.id); } catch { /* ignore */ }
  }

  const done = $derived(completedRounds(app.season, app.snap));
  const total = app.season.races.length;
</script>

<header class="top">
  <a href="#/" class="logo" aria-label="Kick Tip Start">
    <span class="f1">F1</span><span class="kt">Kick&nbsp;Tip</span>
  </a>
  <div class="progress" title="{done} von {total} Rennen gewertet" aria-label="{done} von {total} Rennen gewertet">
    <span class="bar"><span style="width: {(done / total) * 100}%"></span></span>
    <span class="num faint small">{done}/{total}</span>
  </div>
  {#if seen !== LATEST_UPDATE.id}
    <button class="info" onclick={openUpdate} aria-label="Neues Update anzeigen">i<span class="dot"></span></button>
  {/if}
  <button class="me" onclick={onswitch} aria-label="Spieler wechseln">
    {#if app.me}<Avatar id={app.me} size={34} />{:else}<span class="chip">Wer bist du?</span>{/if}
  </button>
</header>

{#if app.mode === 'demo'}
  <div class="demo small">Demo-Daten · Tipps landen nur in diesem Browser</div>
{/if}

<Sheet bind:open={showUpdate} title={LATEST_UPDATE.title}>
  <ul class="updates">
    {#each LATEST_UPDATE.items as item}<li>{item}</li>{/each}
  </ul>
</Sheet>

<style>
  .top {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px;
    padding: calc(10px + var(--safe-t)) 16px 10px;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: saturate(1.6) blur(18px); -webkit-backdrop-filter: saturate(1.6) blur(18px);
    max-width: 640px; margin: 0 auto;
  }
  .logo { display: flex; align-items: baseline; gap: 6px; font-weight: 900; font-size: 21px; letter-spacing: -0.01em; }
  .f1 { background: var(--accent); color: #fff; padding: 0 7px; border-radius: 6px; font-style: italic; transform: skewX(-8deg); display: inline-block; }
  .progress { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .bar { flex: 1; height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; max-width: 140px; margin-left: auto; }
  .bar span { display: block; height: 100%; background: var(--accent-2); border-radius: 2px; }
  .info {
    position: relative; width: 32px; height: 32px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--line);
    font-weight: 900; font-style: italic; font-family: Georgia, serif; color: var(--text-2);
  }
  .dot { position: absolute; top: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-2); box-shadow: 0 0 0 2px var(--bg); }
  .me { display: grid; place-items: center; }
  .demo { text-align: center; background: var(--warn-soft); color: var(--warn); font-weight: 700; padding: 4px 16px; }
  .updates { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; color: var(--text-2); }
</style>
