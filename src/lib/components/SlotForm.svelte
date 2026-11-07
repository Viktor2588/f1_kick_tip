<script lang="ts" module>
  export interface SlotDef {
    name: string;
    label: string;
    kind: 'driver' | 'team';
    /** Slots in the same group can't share a driver; picking a used one swaps them. */
    group?: string;
    multiple?: boolean;
    hint?: string;
    /** Small badge left of the label, e.g. "P1". */
    badge?: string;
    points?: string;
  }
  export type SlotValues = Record<string, string | string[] | null>;
</script>

<script lang="ts">
  import DriverTag from './DriverTag.svelte';
  import PickerSheet from './PickerSheet.svelte';

  let { slots, values = $bindable(), autoAdvance = true }: { slots: SlotDef[]; values: SlotValues; autoAdvance?: boolean } = $props();

  let active: SlotDef | null = $state(null);
  let sheetOpen = $state(false);

  const asList = (v: string | string[] | null | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

  function usedInGroup(slot: SlotDef): string[] {
    if (!slot.group) return [];
    return slots.filter((s) => s.group === slot.group && s.name !== slot.name).flatMap((s) => asList(values[s.name]));
  }

  function openSlot(slot: SlotDef) {
    active = slot;
    sheetOpen = true;
  }

  function pick(id: string) {
    const slot = active;
    if (!slot) return;
    if (slot.multiple) {
      const cur = asList(values[slot.name]);
      values[slot.name] = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return;
    }
    const wasEmpty = !values[slot.name];
    if (slot.group) {
      const other = slots.find((s) => s.group === slot.group && s.name !== slot.name && values[s.name] === id);
      if (other) values[other.name] = values[slot.name] ?? null; // swap
    }
    values[slot.name] = id;
    if (autoAdvance && wasEmpty) {
      const i = slots.indexOf(slot);
      const next = slots.slice(i + 1).find((s) => !s.multiple && !values[s.name]);
      if (next) setTimeout(() => openSlot(next), 180);
    }
  }
</script>

<ul class="slots">
  {#each slots as slot (slot.name)}
    {@const list = asList(values[slot.name])}
    <li>
      <button type="button" class="slot" class:filled={list.length > 0} onclick={() => openSlot(slot)} data-slot={slot.name}>
        {#if slot.badge}<span class="badge">{slot.badge}</span>{/if}
        <span class="label">
          {slot.label}
          {#if slot.hint}<span class="hint">{slot.hint}</span>{/if}
        </span>
        <span class="value">
          {#if list.length === 0}
            <span class="pick">wählen</span>
          {:else if slot.multiple}
            <span class="multi">
              {#each list as id (id)}<DriverTag {id} kind={slot.kind} size="sm" />{/each}
            </span>
          {:else}
            <DriverTag id={list[0]} kind={slot.kind} full />
          {/if}
        </span>
        {#if slot.points}<span class="pts">{slot.points}</span>{/if}
      </button>
      {#if slot.multiple}
        {#each list as id (id)}<input type="hidden" name={slot.name} value={id} />{/each}
      {:else}
        <input type="hidden" name={slot.name} value={list[0] ?? ''} />
      {/if}
    </li>
  {/each}
</ul>

{#if active}
  <PickerSheet
    bind:open={sheetOpen}
    title={active.label}
    kind={active.kind}
    multiple={active.multiple}
    selected={asList(values[active.name])}
    disabled={usedInGroup(active)}
    onpick={pick}
    onclear={() => { if (active) values[active.name] = active.multiple ? [] : null; }}
  />
{/if}

<style>
  .slots { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .slot {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 8px 14px;
    border-radius: 14px;
    border: 1px dashed var(--line);
    background: var(--surface);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.08s;
  }
  .slot:active { transform: scale(0.985); }
  .slot.filled { border-style: solid; }
  .badge {
    min-width: 34px; height: 28px; padding: 0 6px; border-radius: 8px;
    display: grid; place-items: center;
    background: var(--surface-2); font-weight: 900; font-size: 0.85rem;
  }
  .label { display: flex; flex-direction: column; font-weight: 600; line-height: 1.15; }
  .hint { font-size: 0.75rem; color: var(--text-3); font-weight: 400; }
  .value { justify-self: end; text-align: right; }
  .pick { color: var(--accent); font-weight: 700; }
  .multi { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: flex-end; }
  .pts { font-size: 0.72rem; color: var(--text-3); min-width: 3ch; text-align: right; }
</style>
