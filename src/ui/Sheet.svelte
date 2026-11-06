<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let { open = $bindable(false), title = '', children, footer }: {
    open?: boolean;
    title?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  let panel: HTMLDivElement | undefined = $state();

  // Render at <body> level so page transitions can't trap the sheet under the bars.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
  let startY = 0;
  let dy = $state(0);

  $effect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open = false);
    addEventListener('keydown', onKey);
    queueMicrotask(() => panel?.focus());
    return () => {
      document.body.style.overflow = prev;
      removeEventListener('keydown', onKey);
    };
  });

  // Swipe the handle down to close.
  const down = (e: PointerEvent) => { startY = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (startY) dy = Math.max(0, e.clientY - startY); };
  const up = () => { if (dy > 90) open = false; startY = 0; dy = 0; };
</script>

{#if open}
  <div class="portal" use:portal>
  <div class="backdrop" transition:fade={{ duration: 160 }} onclick={() => (open = false)} role="presentation"></div>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    bind:this={panel}
    style:transform={dy ? `translateY(${dy}px)` : undefined}
    transition:fly={{ y: 500, duration: 260, opacity: 1 }}
  >
    <div class="handle" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
      <span></span>
      {#if title}<h2>{title}</h2>{/if}
      <button class="x" onclick={() => (open = false)} aria-label="Schließen">✕</button>
    </div>
    <div class="body">{@render children()}</div>
    {#if footer}<div class="foot">{@render footer()}</div>{/if}
  </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 0.55); z-index: 50; backdrop-filter: blur(2px); }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 51;
    max-height: min(88dvh, 820px); max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column;
    background: var(--bg-2); border-radius: 22px 22px 0 0; border: 1px solid var(--line); border-bottom: 0;
    box-shadow: var(--shadow); outline: none;
    padding-bottom: var(--safe-b);
  }
  .handle { position: relative; padding: 10px 52px 8px 18px; touch-action: none; cursor: grab; }
  .handle span { display: block; width: 40px; height: 5px; border-radius: 3px; background: var(--line-strong); margin: 0 auto 8px; }
  h2 { font-size: 19px; font-weight: 700; }
  .x { position: absolute; right: 10px; top: 18px; width: 36px; height: 36px; border-radius: 50%; background: var(--surface-2); color: var(--text-2); font-size: 14px; }
  .body { overflow-y: auto; padding: 4px 16px 16px; overscroll-behavior: contain; }
  .foot { padding: 12px 16px; border-top: 1px solid var(--line); }
</style>
