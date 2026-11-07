<script lang="ts">
  // A tip form: slot list + sticky save bar. Works without JS (plain form post); with JS it
  // saves in place, shows feedback and refreshes the page data.
  import { enhance } from '$app/forms';
  import SlotForm, { type SlotDef, type SlotValues } from './SlotForm.svelte';
  import { relIn } from '$lib/format';
  import { clock } from '$lib/clock.svelte';

  let {
    action, slots, initial, hasExisting, deadline, submitLabel = 'Tipp abgeben', copyFrom = null, copyLabel = '', serverError = null,
  }: {
    action: string;
    slots: SlotDef[];
    initial: SlotValues;
    hasExisting: boolean;
    deadline: string;
    submitLabel?: string;
    copyFrom?: SlotValues | null;
    copyLabel?: string;
    serverError?: string | null;
  } = $props();

  // Snapshot on mount on purpose: the parent re-keys this component per round.
  // svelte-ignore state_referenced_locally
  let values: SlotValues = $state({ ...initial });
  // svelte-ignore state_referenced_locally
  let saved: SlotValues = $state({ ...initial });
  let busy = $state(false);
  let message: { ok: boolean; text: string } | null = $state(null);

  const same = (a: SlotValues, b: SlotValues) => JSON.stringify(slots.map((s) => a[s.name] ?? null)) === JSON.stringify(slots.map((s) => b[s.name] ?? null));
  const dirty = $derived(!same(values, saved));
  const canSubmit = $derived(!!values[slots[0].name] && (dirty || !hasExisting));
  const filled = $derived(slots.filter((s) => !s.multiple && values[s.name]).length);

  $effect(() => { if (serverError) message = { ok: false, text: serverError }; });
</script>

<form
  method="POST"
  {action}
  use:enhance={() => {
    busy = true;
    message = null;
    return async ({ result, update }) => {
      busy = false;
      if (result.type === 'success') {
        saved = { ...values };
        message = { ok: true, text: 'Gespeichert ✓' };
        if (navigator.vibrate) navigator.vibrate(30);
      } else if (result.type === 'failure') {
        message = { ok: false, text: (result.data?.error as string) ?? 'Speichern fehlgeschlagen' };
      } else if (result.type === 'error') {
        message = { ok: false, text: 'Server nicht erreichbar. Bitte nochmal versuchen.' };
      }
      await update({ reset: false });
    };
  }}
>
  <div class="meta small">
    <span class="muted">{filled} von {slots.filter((s) => !s.multiple).length} ausgefüllt · schließt {relIn(deadline, clock.now)}</span>
    {#if copyFrom && !hasExisting && !dirty}
      <button type="button" class="btn btn-sm btn-ghost" onclick={() => (values = { ...copyFrom })}>{copyLabel}</button>
    {/if}
  </div>

  <SlotForm {slots} bind:values />

  <div class="savebar">
    {#if message}
      <p class="msg" class:ok={message.ok} role="status">{message.text}</p>
    {:else if dirty && hasExisting}
      <p class="msg">Ungespeicherte Änderungen</p>
    {/if}
    <button class="btn btn-primary btn-block" disabled={!canSubmit || busy}>
      {busy ? 'Speichert …' : hasExisting ? (dirty ? 'Änderung speichern' : 'Gespeichert ✓') : submitLabel}
    </button>
  </div>
</form>

<style>
  .meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; min-height: 36px; }
  .savebar {
    position: sticky;
    bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px);
    margin-top: 14px;
    padding: 10px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg-raised) 90%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--line);
    z-index: 5;
  }
  @media (min-width: 900px) { .savebar { bottom: calc(var(--tabbar-h) + 28px); } }
  .msg { margin: 0 4px 8px; font-size: 0.88rem; font-weight: 700; color: var(--bad); }
  .msg.ok { color: var(--good); }
</style>
