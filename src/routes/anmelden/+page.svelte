<script lang="ts">
  import { page } from '$app/state';
  const failed = $derived(page.url.searchParams.get('fehler') === 'link');
</script>

<svelte:head><title>Anmelden – F1 Kick Tip</title></svelte:head>

<div class="card box">
  <h1>Anmelden</h1>
  {#if failed}
    <p class="err">Dieser Link ist nicht (mehr) gültig.</p>
  {/if}
  <p>Jeder Mitspieler hat einen <b>persönlichen Link</b>. Öffne ihn einmal auf deinem Handy, danach bleibst du angemeldet.</p>
  <p class="muted small">Keinen Link oder Handy gewechselt? Frag den Admin nach einem neuen Link. Ein neuer Link macht den alten ungültig.</p>
  <p class="muted small">Tipp: Füge die Seite danach zum Home-Bildschirm hinzu.</p>
</div>

<style>
  .box { max-width: 480px; margin: 0 auto; display: grid; gap: 12px; }
  .err { color: var(--bad); font-weight: 600; }
</style>
