<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick } from 'svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import { season } from '$lib/domain/season';

  let { data, form } = $props();
  let player = $state<string | null>(null);
  let pin = $state('');
  let busy = $state(false);
  let formEl: HTMLFormElement | undefined = $state();

  $effect(() => { if (form?.player && !player) player = form.player; });
  $effect(() => { if (form?.error) pin = ''; });

  async function press(d: string) {
    if (pin.length >= 8) return;
    pin += d;
    if (pin.length === 4 && data.devPin) {
      await tick(); // let the input receive the last digit before submitting
      formEl?.requestSubmit();
    }
  }
</script>

<svelte:head><title>Anmelden · F1 Kick Tip</title></svelte:head>

<main class="page narrow">
  <h1 class="page-title">Wer bist du?</h1>
  <p class="page-sub">Einmal anmelden, dann bleibt dein Handy ein Jahr lang angemeldet.</p>

  <form method="POST" bind:this={formEl} use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
    <input type="hidden" name="next" value={data.next} />
    <div class="players" role="radiogroup" aria-label="Spieler">
      {#each season.players as p (p.id)}
        <label class="pl" class:on={player === p.id} style:--c={p.color}>
          <input type="radio" name="player" value={p.id} bind:group={player} class="sr-only" />
          <Avatar id={p.id} size={52} ring={player === p.id} />
          <span>{p.name}</span>
        </label>
      {/each}
    </div>

    {#if player}
      <label class="pin-label" for="pin">Deine PIN</label>
      <input id="pin" class="pin num" name="pin" bind:value={pin} inputmode="numeric" autocomplete="current-password"
        pattern="[0-9]*" maxlength="8" placeholder="••••" aria-describedby="pin-help" />
      <div class="pad" aria-hidden="true">
        {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as k}
          {#if k === ''}<span></span>
          {:else}
            <button type="button" tabindex="-1" onclick={() => (k === '⌫' ? (pin = pin.slice(0, -1)) : press(k))}>{k}</button>
          {/if}
        {/each}
      </div>
      {#if form?.error}<p class="notice notice-bad" role="alert">{form.error}</p>{/if}
      <button class="btn btn-primary btn-block" disabled={pin.length < 4 || busy}>{busy ? 'Prüfe …' : 'Anmelden'}</button>
      <p id="pin-help" class="small faint help">
        {#if data.devPin}Testmodus: PIN ist <b>0000</b>.{:else}PIN vergessen? Viktor kann sie neu setzen.{/if}
      </p>
    {/if}
  </form>
</main>

<style>
  .narrow { max-width: 440px; }
  .players { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .pl {
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 6px;
    border-radius: 16px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; font-weight: 700;
  }
  .pl.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--surface)); }
  .pin-label { display: block; font-weight: 700; margin-bottom: 6px; }
  .pin {
    width: 100%; min-height: 56px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface);
    color: var(--text); font: inherit; font-size: 1.6rem; letter-spacing: 0.5em; text-align: center; -webkit-text-security: disc;
  }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 16px; }
  .pad button { min-height: 56px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface-2); font-size: 1.4rem; font-weight: 700; cursor: pointer; }
  .pad button:active { background: var(--accent-soft); }
  .notice { margin: 0 0 12px; }
  .help { text-align: center; margin-top: 12px; }
</style>
