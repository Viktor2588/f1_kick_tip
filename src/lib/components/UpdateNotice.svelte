<script lang="ts">
  import { onMount } from 'svelte';
  import { LATEST_UPDATE } from '$lib/update';

  const KEY = 'f1kt_seen_update';
  let unseen = $state(false);
  let dialog: HTMLDialogElement | undefined = $state();

  onMount(() => {
    try { unseen = localStorage.getItem(KEY) !== LATEST_UPDATE.id; } catch { unseen = false; }
  });

  function show() {
    try { localStorage.setItem(KEY, LATEST_UPDATE.id); } catch {}
    unseen = false;
    dialog?.showModal();
  }
</script>

{#if unseen}
  <button class="info" onclick={show} aria-label="Was ist neu?">
    <span>i</span><span class="dot" aria-hidden="true"></span>
  </button>
{/if}

<dialog bind:this={dialog} class="modal" onclick={(e) => { if (e.target === dialog) dialog?.close(); }}>
  <div class="inner">
    <h2>{LATEST_UPDATE.title}</h2>
    <ul>{#each LATEST_UPDATE.items as item}<li>{item}</li>{/each}</ul>
    <button class="btn btn-primary btn-block" onclick={() => dialog?.close()}>Alles klar</button>
  </div>
</dialog>

<style>
  .info {
    position: relative; width: 36px; height: 36px; border-radius: 50%;
    border: 1px solid var(--line); background: var(--surface); cursor: pointer;
    font-weight: 900; font-style: italic; font-family: Georgia, serif;
  }
  .dot { position: absolute; top: 2px; right: 2px; width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }
  .modal { border: none; border-radius: 22px; padding: 0; max-width: min(440px, calc(100vw - 32px)); background: var(--bg-raised); color: var(--text); }
  .modal::backdrop { background: rgb(0 0 0 / 0.55); }
  .inner { padding: 22px; }
  h2 { font-size: 1.35rem; font-weight: 900; margin-bottom: 12px; }
  ul { padding-left: 18px; margin: 0 0 20px; display: grid; gap: 8px; color: var(--text-2); }
</style>
