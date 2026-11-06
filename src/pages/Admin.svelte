<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href, router } from '../lib/router.svelte';
  import { DNF_FROM_ROUND, type SlotMeta, RACE_SLOTS, SPRINT_SLOTS, type RaceSlot } from '../domain/rules';
  import { flag, formatDay } from '../lib/format';
  import { toasts } from '../lib/toast.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Picker from '../ui/Picker.svelte';
  import DriverTag from '../ui/DriverTag.svelte';

  let { round }: { round: number | null } = $props();

  const race = $derived(round != null ? app.race(round) : null);
  const started = (iso: string | null) => !!iso && new Date(iso).getTime() <= app.now;

  // ── Editor state ──────────────────────────────
  type Form = Partial<Record<RaceSlot, string | null>> & { dnfList: string[]; dnsList: string[] };
  let form = $state<Form>({ dnfList: [], dnsList: [] });
  let sprintForm = $state<Partial<Record<'p1' | 'p2' | 'p3', string | null>>>({});
  const single = RACE_SLOTS.filter((s) => !s.optional);
  const withDnf = $derived((round ?? 0) >= DNF_FROM_ROUND);

  $effect.pre(() => {
    if (round == null) return;
    const r = app.snap.raceResults[round];
    form = { ...(r ?? {}), dnfList: r?.dnf ?? [], dnsList: r?.dns ?? [] } as Form;
    const s = app.snap.sprintResults[round];
    sprintForm = s ? { p1: s.p1, p2: s.p2, p3: s.p3 } : {};
  });

  let target = $state<{ slot: SlotMeta; sprint: boolean } | null>(null);
  let sheet = $state(false);
  let listSheet = $state<'dnfList' | 'dnsList' | null>(null);
  let listOpen = $state(false);

  function choose(id: string | null) {
    if (!target) return;
    if (target.sprint) sprintForm[target.slot.key as 'p1'] = id;
    else form[target.slot.key] = id;
    sheet = false;
  }
  function toggle(list: 'dnfList' | 'dnsList', id: string) {
    form[list] = form[list].includes(id) ? form[list].filter((x) => x !== id) : [...form[list], id];
  }

  const raceComplete = $derived(single.every((s) => !!form[s.key]));
  const podiumUnique = $derived(new Set([form.p1, form.p2, form.p3]).size === 3);
  const sprintComplete = $derived(!!(sprintForm.p1 && sprintForm.p2 && sprintForm.p3) && new Set([sprintForm.p1, sprintForm.p2, sprintForm.p3]).size === 3);

  let busy = $state(false);
  let confirmDelete = $state<'race' | 'sprint' | null>(null);

  async function run(fn: () => Promise<void>, msg: string) {
    busy = true;
    try { await fn(); toasts.show(msg, 'good'); } catch (e) { console.error(e); toasts.show('Hat nicht geklappt.', 'bad'); } finally { busy = false; confirmDelete = null; }
  }

  const saveRace = () => run(async () => {
    const prev = app.snap.raceResults[round!];
    const saved = await app.repo!.saveRaceResult(round!, {
      p1: form.p1!, p2: form.p2!, p3: form.p3!, pole: form.pole!, fastestLap: form.fastestLap!, bestConstructor: form.bestConstructor!,
      dnf: withDnf ? $state.snapshot(form.dnfList) : null,
      dns: withDnf ? $state.snapshot(form.dnsList) : null,
      topTen: prev?.topTen ?? null,
    });
    app.snap.raceResults[round!] = saved;
  }, 'Ergebnis gespeichert');

  const saveSprint = () => run(async () => {
    app.snap.sprintResults[round!] = await app.repo!.saveSprintResult(round!, { p1: sprintForm.p1!, p2: sprintForm.p2!, p3: sprintForm.p3! });
  }, 'Sprint-Ergebnis gespeichert');

  const del = (kind: 'race' | 'sprint') => run(async () => {
    if (kind === 'race') { await app.repo!.deleteRaceResult(round!); delete app.snap.raceResults[round!]; }
    else { await app.repo!.deleteSprintResult(round!); delete app.snap.sprintResults[round!]; }
  }, 'Gelöscht');
</script>

<div class="page stack">
  {#if round == null || !race}
    <h1 class="title">Ergebnisse eintragen</h1>
    <p class="muted small">Nach jedem Rennen hier das Ergebnis eintragen. Die Punkte rechnen sich sofort für alle.</p>
    {#if app.mode === 'live'}<p class="chip warn">Live-Daten: Änderungen sehen alle sofort.</p>{/if}
    <div class="card flush list">
      {#each app.season.races as r (r.round)}
        {@const has = !!app.snap.raceResults[r.round]}
        {@const missingSprint = r.sprint && started(r.sprintStartUTC) && !app.snap.sprintResults[r.round]}
        <a class="race" href={href(`admin/${r.round}`)} class:todo={started(r.raceStartUTC) && !has}>
          <span class="faint num rnd">{r.round}</span>
          <span>{flag(r.countryCode)}</span>
          <span class="grow">{r.country} <span class="faint small">{formatDay(r.raceStartUTC)}</span></span>
          {#if has && !missingSprint}<span class="chip good">✓</span>
          {:else if started(r.raceStartUTC) || missingSprint}<span class="chip accent">eintragen</span>{/if}
        </a>
      {/each}
    </div>
  {:else}
    <header class="head">
      <button class="back" onclick={() => router.go('admin')} aria-label="Zurück">‹</button>
      <div class="grow">
        <div class="tiny faint">Ergebnis · Runde {race.round}</div>
        <h1>{flag(race.countryCode)} {race.country}</h1>
      </div>
    </header>

    <div class="section-title">Rennen</div>
    <div class="card flush list">
      {#each single as s (s.key)}
        <button class="slot" onclick={() => { target = { slot: s, sprint: false }; sheet = true; }}>
          <span class="badge">{s.short}</span>
          <span class="grow">{#if form[s.key]}<DriverTag id={form[s.key]} kind={s.kind} full />{:else}<span class="ph">Wählen</span>{/if}</span>
        </button>
      {/each}
      {#if withDnf}
        {#each [['dnfList', 'DNF', 'Ausgefallen'], ['dnsList', 'DNS', 'Nicht gestartet']] as [key, short, label]}
          {@const k = key as 'dnfList' | 'dnsList'}
          <button class="slot" onclick={() => { listSheet = k; listOpen = true; }}>
            <span class="badge">{short}</span>
            <span class="grow">
              {#if form[k].length}{#each form[k] as id}<span class="li"><DriverTag {id} /></span>{/each}{:else}<span class="faint">{label}: keiner</span>{/if}
            </span>
          </button>
        {/each}
      {/if}
    </div>
    {#if raceComplete && !podiumUnique}<p class="chip warn">Ein Fahrer steht doppelt auf dem Podium.</p>{/if}
    <button class="btn primary block" disabled={!raceComplete || !podiumUnique || busy} onclick={saveRace}>Rennergebnis speichern</button>
    {#if app.snap.raceResults[round]}
      {#if confirmDelete === 'race'}
        <button class="btn block danger" onclick={() => del('race')}>Wirklich löschen?</button>
      {:else}
        <button class="btn block ghost danger" onclick={() => (confirmDelete = 'race')}>Rennergebnis löschen</button>
      {/if}
    {/if}

    {#if race.sprint}
      <div class="section-title">Sprint</div>
      <div class="card flush list">
        {#each SPRINT_SLOTS as s (s.key)}
          <button class="slot" onclick={() => { target = { slot: s, sprint: true }; sheet = true; }}>
            <span class="badge">{s.short}</span>
            <span class="grow">{#if sprintForm[s.key as 'p1']}<DriverTag id={sprintForm[s.key as 'p1']} full />{:else}<span class="ph">Wählen</span>{/if}</span>
          </button>
        {/each}
      </div>
      <button class="btn block" disabled={!sprintComplete || busy} onclick={saveSprint}>Sprint-Ergebnis speichern</button>
      {#if app.snap.sprintResults[round]}
        {#if confirmDelete === 'sprint'}
          <button class="btn block danger" onclick={() => del('sprint')}>Wirklich löschen?</button>
        {:else}
          <button class="btn block ghost danger" onclick={() => (confirmDelete = 'sprint')}>Sprint-Ergebnis löschen</button>
        {/if}
      {/if}
    {/if}
  {/if}
</div>

<Sheet bind:open={sheet} title={target?.slot.label ?? ''}>
  {#if target}
    {#key target.slot.key + target.sprint}
      <Picker kind={target.slot.kind} value={target.sprint ? sprintForm[target.slot.key as 'p1'] : form[target.slot.key]} onpick={choose} />
    {/key}
  {/if}
</Sheet>

<Sheet bind:open={listOpen} title={listSheet === 'dnfList' ? 'Ausgefallen (DNF)' : 'Nicht gestartet (DNS)'}>
  {#if listSheet}
    {@const k = listSheet}
    <div class="multi">
      {#each app.season.drivers as d (d.id)}
        {@const other = k === 'dnfList' ? form.dnsList : form.dnfList}
        <button class="m" class:on={form[k].includes(d.id)} disabled={other.includes(d.id)} onclick={() => toggle(k, d.id)} style="--tc: {app.driverColor(d.id)}">
          <DriverTag id={d.id} />
        </button>
      {/each}
    </div>
  {/if}
  {#snippet footer()}<button class="btn primary block" onclick={() => (listOpen = false)}>Fertig</button>{/snippet}
</Sheet>

<style>
  .title { font-size: 26px; font-weight: 900; margin: 4px 2px; }
  .head { display: flex; align-items: center; gap: 10px; }
  .back { width: 40px; height: 40px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); font-size: 26px; line-height: 1; padding-bottom: 3px; }
  h1 { font-size: 24px; font-weight: 900; }
  .race { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
  .race.todo { background: var(--accent-soft); }
  .rnd { width: 20px; text-align: right; }
  .slot { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; min-height: 56px; font-size: 16px; }
  .badge { width: 44px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-weight: 900; font-size: 12px; background: var(--surface-2); color: var(--text-2); flex: none; }
  .ph { color: var(--accent-2); font-weight: 700; }
  .li { display: inline-flex; margin-right: 10px; }
  .multi { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .m { text-align: left; padding: 12px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
  .m.on { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 14%, var(--surface)); }
  .m:disabled { opacity: 0.35; }
</style>
