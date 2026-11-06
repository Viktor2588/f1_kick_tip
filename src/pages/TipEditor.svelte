<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href, router } from '../lib/router.svelte';
  import { raceSlotsFor, SPRINT_SLOTS, SLOT_POINTS, SPRINT_POINTS, type SlotMeta, type RaceSlot } from '../domain/rules';
  import { racePhase, sprintPhase } from '../domain/season';
  import { flag, formatDayTime, relative } from '../lib/format';
  import { toasts, buzz } from '../lib/toast.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Picker from '../ui/Picker.svelte';
  import DriverTag from '../ui/DriverTag.svelte';
  import Countdown from '../ui/Countdown.svelte';

  let { round, sprint = false, onpickplayer }: { round: number; sprint?: boolean; onpickplayer: () => void } = $props();

  type Draft = Partial<Record<RaceSlot, string | null>>;
  const PODIUM: RaceSlot[] = ['p1', 'p2', 'p3'];

  const race = $derived(app.race(round));
  const slots: SlotMeta[] = $derived(sprint ? SPRINT_SLOTS : raceSlotsFor(round));
  const deadline = $derived(race ? (sprint ? race.sprintStartUTC : race.raceStartUTC) : null);
  const phase = $derived(race ? (sprint ? sprintPhase(race, app.snap, app.now) : racePhase(race, app.snap, app.now)) : null);
  const existing = $derived.by(() => {
    if (!app.me) return undefined;
    return sprint ? app.snap.sprintTips[round]?.[app.me] : app.snap.raceTips[round]?.[app.me];
  });
  const draftKey = $derived(`f1kt_draft_${app.me}_${round}${sprint ? '_s' : ''}`);

  let draft = $state<Draft>({});
  let loadedFor = '';
  // (Re)initialise when player/round changes: stored draft > saved tip > empty.
  $effect(() => {
    const key = draftKey;
    if (key === loadedFor) return;
    loadedFor = key;
    let stored: Draft | null = null;
    try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* ignore */ }
    draft = stored ?? (existing ? pick(existing as unknown as Draft) : {});
  });

  function pick(src: Draft): Draft {
    const o: Draft = {};
    for (const s of slots) o[s.key] = src[s.key] ?? null;
    return o;
  }

  function persistDraft() {
    try { localStorage.setItem(draftKey, JSON.stringify($state.snapshot(draft))); } catch { /* ignore */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }

  const complete = $derived(slots.every((s) => s.optional || !!draft[s.key]));
  const filled = $derived(slots.filter((s) => !s.optional && draft[s.key]).length);
  const required = $derived(slots.filter((s) => !s.optional).length);
  const dirty = $derived(!existing || slots.some((s) => (draft[s.key] ?? null) !== ((existing as unknown as Draft)[s.key] ?? null)));

  const pointsFor = (k: RaceSlot) => (sprint ? (SPRINT_POINTS as Record<string, number>)[k] : SLOT_POINTS[k]);

  // ── Picking ─────────────────────────────────────
  let active = $state<SlotMeta | null>(null);
  let sheetOpen = $state(false);
  $effect(() => { if (!sheetOpen) active = null; });

  function openSlot(s: SlotMeta) {
    active = s;
    sheetOpen = true;
  }

  const used = $derived.by(() => {
    const out: Record<string, string> = {};
    for (const s of slots) {
      const v = draft[s.key];
      if (v && s.kind === 'driver' && s.key !== active?.key && (PODIUM.includes(s.key) || s.optional)) out[v] = s.short;
    }
    return out;
  });

  function choose(id: string | null) {
    if (!active) return;
    const key = active.key;
    const prev = draft[key] ?? null;
    // A driver can only hold one podium spot: picking one that's already on the podium swaps them.
    if (id && PODIUM.includes(key)) {
      for (const k of PODIUM) if (k !== key && draft[k] === id) draft[k] = prev;
    }
    // DNF and DNS can't be the same driver.
    if (id && (key === 'dnf' || key === 'dns')) {
      const other = key === 'dnf' ? 'dns' : 'dnf';
      if (draft[other] === id) draft[other] = null;
    }
    draft[key] = id;
    persistDraft();
    buzz(8);
    // Walk straight on to the next empty required slot.
    const nextEmpty = slots.find((s) => !s.optional && !draft[s.key]);
    if (nextEmpty && !existing) active = nextEmpty;
    else sheetOpen = false;
  }

  // ── Copy last tip ───────────────────────────────
  const lastTip = $derived.by(() => {
    if (!app.me || existing) return null;
    const src = sprint ? app.snap.sprintTips : app.snap.raceTips;
    const prevRound = Object.keys(src).map(Number).filter((r) => r < round && src[r]?.[app.me!]).sort((a, b) => b - a)[0];
    return prevRound ? { round: prevRound, tip: src[prevRound][app.me] as unknown as Draft } : null;
  });
  function copyLast() {
    if (!lastTip) return;
    draft = pick(lastTip.tip);
    if (!sprint && round >= 16 && lastTip.round < 16) { draft.dnf = null; draft.dns = null; }
    persistDraft();
    toasts.show(`Tipp aus Runde ${lastTip.round} übernommen`);
  }

  // ── Submit ──────────────────────────────────────
  let saving = $state(false);
  let justSaved = $state(false);

  async function submit() {
    if (!app.repo || !app.me || !race || !deadline || !complete) return;
    if (app.repo.kind === 'live' && Date.now() >= new Date(deadline).getTime()) {
      toasts.show('Zu spät: Die Deadline ist vorbei.', 'bad');
      return;
    }
    saving = true;
    try {
      const d = $state.snapshot(draft);
      if (sprint) {
        const saved = await app.repo.saveSprintTip(round, app.me, { p1: d.p1!, p2: d.p2!, p3: d.p3! });
        (app.snap.sprintTips[round] ??= {})[app.me] = saved;
      } else {
        const saved = await app.repo.saveRaceTip(round, app.me, {
          p1: d.p1!, p2: d.p2!, p3: d.p3!, pole: d.pole!, fastestLap: d.fastestLap!, bestConstructor: d.bestConstructor!,
          dnf: d.dnf ?? null, dns: d.dns ?? null,
        });
        (app.snap.raceTips[round] ??= {})[app.me] = saved;
      }
      clearDraft();
      buzz([10, 40, 20]);
      justSaved = true;
      toasts.show(sprint ? 'Sprint-Tipp gespeichert' : 'Tipp gespeichert', 'good');
    } catch (e) {
      console.error(e);
      toasts.show('Speichern hat nicht geklappt. Netz prüfen und nochmal versuchen.', 'bad', 5000);
    } finally {
      saving = false;
    }
  }
</script>

{#if !race}
  <div class="page"><div class="card empty">Diese Runde gibt es nicht. <a href={href('')}>Zum Start</a></div></div>
{:else}
  <div class="page stack">
    <header class="head">
      <button class="back" onclick={() => router.back(`rennen/${round}`)} aria-label="Zurück">‹</button>
      <div class="grow">
        <div class="tiny faint">Runde {round} · {sprint ? 'Sprint-Tipp' : 'Renn-Tipp'}</div>
        <h1>{flag(race.countryCode)} {race.country}</h1>
      </div>
      {#if race.sprint}
        <a class="chip" class:sprint={!sprint} href={href(sprint ? `tipp/${round}` : `tipp/${round}/sprint`)}>{sprint ? 'Zum Rennen' : 'Sprint'} ›</a>
      {/if}
    </header>

    {#if !app.me}
      <div class="card empty">
        <div class="big">👋</div>
        <p>Wer tippt hier?</p>
        <button class="btn primary" onclick={onpickplayer} style="margin-top: 12px">Spieler wählen</button>
      </div>
    {:else if phase !== 'open'}
      <div class="card empty">
        <div class="big">🔒</div>
        <strong>Tippschluss war {deadline ? formatDayTime(deadline) : ''}.</strong>
        <p class="small">Hier siehst du, wer was getippt hat:</p>
        <a class="btn" href={href(`rennen/${round}`)} style="margin-top: 12px">Zum Rennen ›</a>
      </div>
    {:else if justSaved}
      <div class="card done-card rise">
        <div class="tick" aria-hidden="true">✓</div>
        <h2>{sprint ? 'Sprint-Tipp' : 'Tipp'} ist drin!</h2>
        <p class="muted small">Du kannst ihn bis {formatDayTime(deadline!)} noch ändern.</p>
        <div class="summary">
          {#each slots as s (s.key)}
            {#if draft[s.key]}
              <div class="sum-row"><span class="faint small">{s.short}</span><DriverTag id={draft[s.key]} kind={s.kind} /></div>
            {/if}
          {/each}
        </div>
        <div class="row">
          <button class="btn grow" onclick={() => (justSaved = false)}>Ändern</button>
          <a class="btn primary grow" href={href('')}>Fertig</a>
        </div>
      </div>
    {:else}
      <div class="deadline card">
        <div class="grow">
          <div class="tiny faint">Tippschluss {sprint ? 'Sprintstart' : 'Rennstart'}</div>
          <strong>{formatDayTime(deadline!)}</strong>
        </div>
        <Countdown target={deadline!} compact />
      </div>

      {#if existing}
        <p class="small muted note">Du hast schon getippt. Änderungen ersetzen deinen Tipp.</p>
      {:else if lastTip && filled === 0}
        <button class="btn ghost small-btn" onclick={copyLast}>↺ Tipp aus Runde {lastTip.round} übernehmen</button>
      {/if}

      <div class="card flush list slots">
        {#each slots as s, i (s.key)}
          {#if s.key === 'dnf'}<div class="divider tiny faint">Freiwillige Bonus-Tipps</div>{/if}
          <button class="slot" class:filled={!!draft[s.key]} onclick={() => openSlot(s)}>
            <span class="badge" class:podium={i < 3}>{s.short}</span>
            <span class="grow">
              <span class="lbl small faint">{s.label}</span>
              {#if draft[s.key]}
                <span class="val"><DriverTag id={draft[s.key]} kind={s.kind} full /></span>
              {:else}
                <span class="val placeholder">{s.optional ? 'Optional' : 'Wählen'}</span>
              {/if}
            </span>
            <span class="pts">+{pointsFor(s.key)}</span>
          </button>
        {/each}
      </div>
      <p class="faint small center">Fahrer auf dem Podium, aber falsche Position: +1 je Fahrer. Alles richtig: +{sprint ? 2 : 5} Bonus.</p>
    {/if}
  </div>

  {#if app.me && phase === 'open' && !justSaved}
    <div class="submit-bar">
      <button class="btn primary block" disabled={!complete || saving || !dirty} onclick={submit}>
        {#if saving}Speichere …{:else if !complete}Noch {required - filled} offen{:else if existing && !dirty}Gespeichert ✓{:else if existing}Änderungen speichern{:else}Tipp abgeben · {relative(deadline!, app.now)} Schluss{/if}
      </button>
    </div>
  {/if}

  <Sheet bind:open={sheetOpen} title={active?.label ?? ''}>
    {#if active}
      {#key active.key}
        <Picker kind={active.kind} value={draft[active.key]} {used} optional={active.optional} hint={active.hint} onpick={choose} />
      {/key}
    {/if}
  </Sheet>
{/if}

<style>
  .head { display: flex; align-items: center; gap: 10px; }
  .back { width: 40px; height: 40px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); font-size: 26px; line-height: 1; padding-bottom: 3px; }
  h1 { font-size: 24px; font-weight: 900; line-height: 1.1; }
  .deadline { display: flex; align-items: center; gap: 12px; }
  .note { margin: 0 4px; }
  .small-btn { min-height: 40px; font-size: 14px; color: var(--accent-2); align-self: flex-start; padding: 0 8px; }
  .slots { display: block; }
  .slot { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; min-height: 64px; }
  .slot:active { background: var(--surface-2); }
  .badge { width: 44px; height: 32px; border-radius: 10px; display: grid; place-items: center; font-weight: 900; font-size: 13px; background: var(--surface-2); color: var(--text-2); flex: none; }
  .badge.podium { background: var(--accent-soft); color: var(--accent-2); }
  .filled .badge { background: var(--good-soft); color: var(--good); }
  .lbl { display: block; line-height: 1.1; }
  .val { display: block; font-size: 17px; margin-top: 2px; }
  .placeholder { color: var(--accent-2); font-weight: 700; }
  .divider { padding: 14px 14px 6px; background: var(--bg-2); }
  .center { text-align: center; padding: 0 12px; }
  .submit-bar {
    position: fixed; left: 0; right: 0; bottom: calc(var(--tabbar-h) + var(--safe-b)); z-index: 35;
    padding: 10px 16px; max-width: 640px; margin: 0 auto;
    background: linear-gradient(to top, var(--bg) 60%, transparent);
  }
  .submit-bar .btn { min-height: 54px; }
  :global(.page:has(+ .submit-bar)) { padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + 96px); }
  .done-card { text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: stretch; padding: 24px 16px 16px; }
  .tick { width: 64px; height: 64px; margin: 0 auto 4px; border-radius: 50%; display: grid; place-items: center; font-size: 32px; font-weight: 900; color: #fff; background: var(--good); animation: pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  @keyframes pop { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .summary { display: flex; flex-direction: column; gap: 6px; text-align: left; background: var(--surface-2); border-radius: 14px; padding: 12px; margin: 6px 0; }
  .sum-row { display: grid; grid-template-columns: 44px 1fr; align-items: center; }
</style>
