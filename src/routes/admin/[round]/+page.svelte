<script lang="ts">
  import { enhance } from '$app/forms';
  import SlotForm, { type SlotDef, type SlotValues } from '$lib/components/SlotForm.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import { season, flag, raceByRound, playerById } from '$lib/domain/season';
  import { dnfDnsActive } from '$lib/domain/schedule';
  import { scoreRace, scoreSprint } from '$lib/domain/scoring';
  import { isHidden, type RaceResult, type SprintResult } from '$lib/domain/types';
  import { fmtStamp } from '$lib/format';

  let { data, form } = $props();
  const race = $derived(raceByRound(data.round)!);
  const key = $derived(String(race.round));
  const withDnf = $derived(dnfDnsActive(season, race.round));
  const existing = $derived(data.game.raceResults[key]);
  const existingSprint = $derived(data.game.sprintResults[key]);

  const raceSlots = $derived<SlotDef[]>([
    { name: 'p1', label: 'Sieger', badge: 'P1', kind: 'driver', group: 'podium' },
    { name: 'p2', label: 'Zweiter', badge: 'P2', kind: 'driver', group: 'podium' },
    { name: 'p3', label: 'Dritter', badge: 'P3', kind: 'driver', group: 'podium' },
    { name: 'pole', label: 'Pole Position', badge: '⏱', kind: 'driver' },
    { name: 'fastestLap', label: 'Schnellste Runde', badge: '⚡', kind: 'driver' },
    { name: 'bestConstructor', label: 'Bester Konstrukteur', badge: '🏭', kind: 'team' },
    ...(withDnf ? ([
      { name: 'dnf', label: 'DNF (alle)', badge: '💥', kind: 'driver', multiple: true, hint: 'gestartet, nicht im Ziel' },
      { name: 'dns', label: 'DNS (alle)', badge: '🚫', kind: 'driver', multiple: true, hint: 'nicht gestartet' },
    ] as SlotDef[]) : []),
  ]);
  const sprintSlots: SlotDef[] = [
    { name: 'p1', label: 'Sprint-Sieger', badge: 'P1', kind: 'driver', group: 'podium' },
    { name: 'p2', label: 'Zweiter', badge: 'P2', kind: 'driver', group: 'podium' },
    { name: 'p3', label: 'Dritter', badge: 'P3', kind: 'driver', group: 'podium' },
  ];

  const fromResult = (r: RaceResult | undefined): SlotValues => ({
    p1: r?.podium[0] ?? null, p2: r?.podium[1] ?? null, p3: r?.podium[2] ?? null,
    pole: r?.pole ?? null, fastestLap: r?.fastestLap ?? null, bestConstructor: r?.bestConstructor ?? null,
    dnf: r?.dnf ?? [], dns: r?.dns ?? [],
  });

  let values: SlotValues = $state({});
  let sprintValues: SlotValues = $state({});
  let topTen: string[] = $state([]);
  let loadedFor = -1;
  $effect.pre(() => {
    if (loadedFor === race.round) return;
    loadedFor = race.round;
    values = fromResult(existing);
    sprintValues = { p1: existingSprint?.podium[0] ?? null, p2: existingSprint?.podium[1] ?? null, p3: existingSprint?.podium[2] ?? null };
    topTen = existing?.topTen ?? [];
  });

  let importing = $state<'race' | 'sprint' | null>(null);
  let note: { ok: boolean; text: string } | null = $state(null);

  async function importFrom(kind: 'race' | 'sprint') {
    importing = kind;
    note = null;
    try {
      const res = await fetch(`/admin/${race.round}/import?kind=${kind}`);
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      if (kind === 'race') {
        if (!body.race) throw new Error('Noch kein Ergebnis in der F1-API');
        const r = body.race;
        values = { p1: r.podium[0], p2: r.podium[1], p3: r.podium[2], pole: r.pole, fastestLap: r.fastestLap, bestConstructor: r.bestConstructor, dnf: r.dnf, dns: r.dns };
        topTen = r.topTen;
        note = { ok: true, text: `Geladen. Bitte prüfen und speichern.${r.warnings.length ? ' Hinweis: ' + r.warnings.join('; ') : ''}` };
      } else {
        if (!body.sprint) throw new Error('Noch kein Sprint-Ergebnis in der F1-API');
        sprintValues = { p1: body.sprint.podium[0], p2: body.sprint.podium[1], p3: body.sprint.podium[2] };
        note = { ok: true, text: 'Sprint geladen. Bitte prüfen und speichern.' };
      }
    } catch (e) {
      note = { ok: false, text: (e as Error).message };
    } finally {
      importing = null;
    }
  }

  // Live preview: what each player would get with the values in the form.
  const preview = $derived.by(() => {
    const p = [values.p1, values.p2, values.p3] as RaceResult['podium'];
    if (!p[0]) return null;
    const res: RaceResult = {
      podium: p, pole: (values.pole as string) ?? null, fastestLap: (values.fastestLap as string) ?? null,
      bestConstructor: (values.bestConstructor as string) ?? null,
      dnf: withDnf ? ((values.dnf as string[]) ?? []) : null, dns: withDnf ? ((values.dns as string[]) ?? []) : null,
      topTen: null, enteredAt: '',
    };
    return season.players.map((pl) => {
      const t = data.game.raceTips[key]?.[pl.id];
      return { id: pl.id, tip: !!t, score: t && !isHidden(t) ? scoreRace(t, res, race) : null };
    });
  });
  const sprintPreview = $derived.by(() => {
    const p = [sprintValues.p1, sprintValues.p2, sprintValues.p3] as SprintResult['podium'];
    if (!race.sprint || !p[0]) return null;
    return season.players.map((pl) => {
      const t = data.game.sprintTips[key]?.[pl.id];
      return { id: pl.id, tip: !!t, score: t && !isHidden(t) ? scoreSprint(t, { podium: p, enteredAt: '' }, race) : null };
    });
  });

  const enhanceWith = () => {
    note = null;
    return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => { await update({ reset: false }); };
  };
</script>

<svelte:head><title>Admin R{race.round} · F1 Kick Tip</title></svelte:head>

<main class="page">
  <nav class="small crumbs"><a href="/admin">← Alle Runden</a><a href="/rennen/{race.round}">Zur Rennseite →</a></nav>
  <h1 class="page-title">{flag(race.countryCode)} R{race.round} {race.country}</h1>
  <p class="page-sub">{existing ? `Ergebnis eingetragen ${fmtStamp(existing.enteredAt)}` : 'Noch kein Ergebnis'}</p>

  {#if note}<p class="notice {note.ok ? 'notice-good' : 'notice-bad'}" role="status">{note.text}</p>{/if}
  {#if form?.error}<p class="notice notice-bad" role="alert">{form.error}</p>{/if}
  {#if form?.saved}<p class="notice notice-good" role="status">{form.kind === 'sprint' ? 'Sprint-Ergebnis' : 'Ergebnis'} gespeichert ✓</p>{/if}
  {#if form?.deleted}<p class="notice" role="status">Gelöscht.</p>{/if}

  {#if race.sprint}
    <section class="section">
      <h2 class="section-title">Sprint
        <button type="button" class="btn btn-sm" onclick={() => importFrom('sprint')} disabled={!!importing}>{importing === 'sprint' ? 'Lade …' : 'Von F1-API laden'}</button>
      </h2>
      <form method="POST" action="?/sprint" use:enhance={enhanceWith}>
        <SlotForm slots={sprintSlots} bind:values={sprintValues} />
        {#if sprintPreview}
          <ul class="preview">{#each sprintPreview as x (x.id)}<li><Avatar id={x.id} size={22} />{playerById(x.id)?.name}<b class="num">{x.score ? `+${x.score.total}` : x.tip ? '?' : '–'}</b></li>{/each}</ul>
        {/if}
        <div class="actions">
          <button class="btn btn-primary">Sprint speichern</button>
          {#if existingSprint}<button class="btn btn-danger" formaction="?/deleteSprint" onclick={(e) => { if (!confirm('Sprint-Ergebnis löschen?')) e.preventDefault(); }}>Löschen</button>{/if}
        </div>
      </form>
    </section>
  {/if}

  <section class="section">
    <h2 class="section-title">Rennen
      <button type="button" class="btn btn-sm" onclick={() => importFrom('race')} disabled={!!importing}>{importing === 'race' ? 'Lade …' : 'Von F1-API laden'}</button>
    </h2>
    <form method="POST" action="?/race" use:enhance={enhanceWith}>
      <SlotForm slots={raceSlots} bind:values autoAdvance={false} />
      {#each topTen as id}<input type="hidden" name="topTen" value={id} />{/each}
      {#if preview}
        <h3 class="small faint pv-title">Punkte-Vorschau</h3>
        <ul class="preview">
          {#each preview as x (x.id)}
            <li><Avatar id={x.id} size={22} />{playerById(x.id)?.name}
              <b class="num">{x.score ? `+${x.score.total}${x.score.isPerfect ? ' ⭐' : ''}${x.score.late ? ' (verspätet)' : ''}` : x.tip ? '?' : 'kein Tipp'}</b></li>
          {/each}
        </ul>
      {/if}
      <div class="actions">
        <button class="btn btn-primary">Ergebnis speichern</button>
        {#if existing}<button class="btn btn-danger" formaction="?/deleteRace" onclick={(e) => { if (!confirm('Rennergebnis löschen?')) e.preventDefault(); }}>Löschen</button>{/if}
      </div>
    </form>
  </section>
</main>

<style>
  .crumbs { display: flex; justify-content: space-between; padding: 8px 0; }
  .crumbs a { color: var(--text-2); text-decoration: none; font-weight: 600; }
  .notice { margin: 0 0 10px; }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .actions .btn-primary { flex: 1; }
  .pv-title { margin: 16px 4px 6px; text-transform: uppercase; letter-spacing: 0.08em; }
  .preview { list-style: none; padding: 10px 14px; margin: 10px 0 0; border-radius: 14px; background: var(--surface-2); display: grid; gap: 6px; }
  .preview li { display: flex; align-items: center; gap: 8px; }
  .preview b { margin-left: auto; }
</style>
