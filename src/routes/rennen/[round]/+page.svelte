<script lang="ts">
  import Countdown from '$lib/components/Countdown.svelte';
  import Driver from '$lib/components/Driver.svelte';
  import TipForm from '$lib/components/TipForm.svelte';
  import { flag, fmtDate, fmtDateTime } from '$lib/race';

  let { data, form } = $props();
  const drivers = $derived(Object.values(data.meta.drivers) as import('$lib/types').Driver[]);
  const teams = $derived(Object.values(data.meta.teams) as import('$lib/types').Team[]);
  const fb = (kind: 'race' | 'sprint') => (form?.form === kind ? form : null);
  const v = $derived(data.view);
  const players = $derived(data.meta.players);
  const statusLabel = { open: 'Tipps offen', locked: 'Tipps geschlossen', finished: 'Gewertet' } as const;
  const verdictIcon = { correct: '✓', partial: '≈', wrong: '✗' } as const;
  const isTeamKey = (key: string) => key === 'bestConstructor';

  const raceRows = [
    ['winner', 'Rennsieger (= P1)'], ['podiumP2', 'Podium P2'], ['podiumP3', 'Podium P3'], ['podiumBonus', 'Podium-Bonus'],
    ['pole', 'Pole Position'], ['fastestLap', 'Schnellste Runde'], ['bestConstructor', 'Bester Konstrukteur'], ['perfectRound', 'Perfekte Runde'],
  ] as const;
  const sprintRows = [['sprintWinner', 'Sprint-Sieger'], ['sprintP2', 'Sprint P2'], ['sprintP3', 'Sprint P3'], ['sprintPodiumBonus', 'Sprint Podium-Bonus'], ['perfectSprint', 'Perfekter Sprint']] as const;
</script>

<svelte:head><title>{v.race.name} – F1 Kick Tip</title></svelte:head>

<div class="stack">
  <header class="head">
    <a href="/rennen" class="back small">← Kalender</a>
    <h1><span aria-hidden="true">{flag(v.race.countryCode)}</span> {v.race.name}</h1>
    <p class="muted small">Runde {v.race.round} · {v.race.circuit}, {v.race.city} · {fmtDate(v.race.date)}</p>
    <div class="chips">
      <span class="chip {v.status}">{statusLabel[v.status]}</span>
      {#if v.race.sprint}<span class="chip sprint">Sprint</span>{/if}
    </div>
  </header>

  {#if v.status === 'open'}
    <section class="card deadline">
      <div class="small">Tipp-Schluss: Rennstart, {fmtDateTime(v.race.raceStartUTC)} Uhr</div>
      <Countdown target={v.race.raceStartUTC} />
      {#if v.sprintStatus === 'open' && v.race.sprintStartUTC}
        <div class="small sprint-dl">Sprint-Tipps bis {fmtDateTime(v.race.sprintStartUTC)} Uhr · <Countdown target={v.race.sprintStartUTC} compact /></div>
      {/if}
    </section>
  {/if}

  {#if v.status === 'open' || v.sprintStatus === 'open'}
    {#if !data.me}
      <section class="card login">
        <b>Tippen?</b> Öffne deinen persönlichen Link, dann kannst du hier tippen. <a href="/anmelden">Wie geht das?</a>
      </section>
    {:else}
      {#if v.sprintStatus === 'open'}
        <section>
          <h2 class="h">Dein Sprint-Tipp <span class="chip sprint">Sprint</span></h2>
          <TipForm kind="sprint" initial={v.own?.sprint ?? null} {drivers} {teams} feedback={fb('sprint')} />
        </section>
      {/if}
      {#if v.status === 'open'}
        <section>
          <h2 class="h">Dein Tipp</h2>
          <TipForm kind="race" initial={v.own?.race ?? null} {drivers} {teams} feedback={fb('race')} />
        </section>
      {/if}
    {/if}
  {/if}

  {#if v.result}
    <section>
      <h2 class="h">Ergebnis</h2>
      <div class="card result">
        <ol class="podium">
          <li class="p2"><span class="pos">P2</span><Driver id={v.result.podium?.[1]} full /></li>
          <li class="p1"><span class="pos">P1</span><Driver id={v.result.winner} full /></li>
          <li class="p3"><span class="pos">P3</span><Driver id={v.result.podium?.[2]} full /></li>
        </ol>
        <dl class="facts">
          <dt>Pole Position</dt><dd><Driver id={v.result.pole} full /></dd>
          <dt>Schnellste Runde</dt><dd><Driver id={v.result.fastestLap} full /></dd>
          <dt>Bester Konstrukteur</dt><dd><Driver id={v.result.bestConstructor} team /></dd>
          {#if v.result.dnf}
            <dt>DNF</dt><dd>{#each v.result.dnf as d, i}{#if i}, {/if}<Driver id={d} />{:else}–{/each}</dd>
            <dt>DNS</dt><dd>{#each v.result.dns ?? [] as d, i}{#if i}, {/if}<Driver id={d} />{:else}–{/each}</dd>
          {/if}
        </dl>
      </div>
    </section>
  {/if}

  {#if v.scores}
    <section>
      <h2 class="h">Punkte</h2>
      <div class="scores">
        {#each v.scores as s}
          <details class="card score" style:--pc={s.player.color} open={false}>
            <summary>
              <span class="name">{s.player.emoji} {s.player.name}</span>
              {#if s.raceScore?.isPerfect}<span class="chip gold">Perfekt</span>{/if}
              {#if s.raceScore?.late}<span class="chip late">Verspätet</span>{/if}
              <span class="total tnum">{s.total} Pkt.</span>
            </summary>
            {#if s.raceScore && !s.raceScore.late}
              <ul class="lines">
                {#each raceRows as [key, label]}
                  <li><span>{label}</span><span class:pos={s.raceScore.breakdown[key] > 0}>{s.raceScore.breakdown[key]}</span></li>
                {/each}
                {#if v.result?.dnf}
                  <li><span>DNF</span><span class:pos={s.raceScore.breakdown.dnf > 0}>{s.raceScore.breakdown.dnf}</span></li>
                  <li><span>DNS</span><span class:pos={s.raceScore.breakdown.dns > 0}>{s.raceScore.breakdown.dns}</span></li>
                {/if}
                <li class="sum"><span>Rennen</span><span>{s.raceScore.total}</span></li>
              </ul>
            {:else if !s.raceScore}
              <p class="muted small">Kein Renntipp</p>
            {/if}
            {#if s.sprintScore && !s.sprintScore.late}
              <ul class="lines">
                {#each sprintRows as [key, label]}
                  <li><span>{label}</span><span class:pos={s.sprintScore.breakdown[key] > 0}>{s.sprintScore.breakdown[key]}</span></li>
                {/each}
                <li class="sum"><span>Sprint</span><span>{s.sprintScore.total}</span></li>
              </ul>
            {/if}
          </details>
        {/each}
      </div>
    </section>
  {/if}

  <section>
    <h2 class="h">Tipps</h2>
    {#if !v.hasRaceTips}
      <p class="muted">Noch keine Tipps abgegeben.</p>
    {:else}
      {#if !v.raceRevealed}<p class="muted small note">Die Tipps werden beim Rennstart aufgedeckt.</p>{/if}
      <div class="tips">
        {#each v.raceTable as row}
          <div class="card cat">
            <div class="cat-name">{row.label}</div>
            <ul>
              {#each row.cells as cell, i}
                <li>
                  <span class="muted">{players[i].emoji} {players[i].name}</span>
                  {#if !cell}<span class="muted">–</span>
                  {:else if 'hidden' in cell}<span class="muted hidden-tip">abgegeben</span>
                  {:else}
                    <span class="val {cell.verdict ?? ''}">
                      {#if cell.value}<Driver id={cell.value} team={isTeamKey(row.key)} />{:else}–{/if}
                      {#if cell.late}<span class="chip late">Verspätet</span>{:else if cell.verdict}<span class="icon" aria-label={cell.verdict}>{verdictIcon[cell.verdict]}</span>{/if}
                    </span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  {#if v.sprintTable}
    <section>
      <h2 class="h">Sprint-Tipps</h2>
      {#if !v.hasSprintTips}
        <p class="muted">Noch keine Sprint-Tipps abgegeben.</p>
      {:else}
        {#if !v.sprintRevealed}<p class="muted small note">Die Sprint-Tipps werden beim Sprint-Start aufgedeckt.</p>{/if}
        <div class="tips">
          {#each v.sprintTable as row}
            <div class="card cat">
              <div class="cat-name">{row.label}</div>
              <ul>
                {#each row.cells as cell, i}
                  <li>
                    <span class="muted">{players[i].emoji} {players[i].name}</span>
                    {#if !cell}<span class="muted">–</span>
                    {:else if 'hidden' in cell}<span class="muted hidden-tip">abgegeben</span>
                    {:else}
                      <span class="val {cell.verdict ?? ''}">
                        {#if cell.value}<Driver id={cell.value} />{:else}–{/if}
                        {#if cell.late}<span class="chip late">Verspätet</span>{:else if cell.verdict}<span class="icon" aria-label={cell.verdict}>{verdictIcon[cell.verdict]}</span>{/if}
                      </span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .back { color: var(--accent-text); font-weight: 600; }
  .head h1 { margin: 6px 0 4px; }
  .chips { display: flex; gap: 6px; margin-top: 10px; }
  .h { margin-bottom: 10px; }
  .deadline { display: grid; gap: 10px; background: linear-gradient(135deg, #e10600, #8e0400); color: #fff; border: 0; }
  .sprint-dl { opacity: 0.95; }
  .login a { color: var(--accent-text); font-weight: 600; }

  .podium { list-style: none; display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 6px; }
  .podium li { background: var(--surface-2); border-radius: 12px 12px 4px 4px; padding: 10px 6px; text-align: center; font-weight: 700; font-size: 0.85rem; display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
  .podium li :global(.d) { white-space: normal; }
  .podium .p1 { padding-top: 22px; background: var(--gold-bg); font-size: 0.95rem; }
  .podium .p2 { padding-top: 14px; }
  .pos { font-size: 0.72rem; color: var(--text-3); }
  .facts { display: grid; grid-template-columns: auto 1fr; gap: 0 12px; margin-top: 12px; font-size: 0.9rem; }
  .facts dt, .facts dd { padding: 8px 0; border-top: 1px solid var(--line); }
  .facts dt { color: var(--text-3); }
  .facts dd { text-align: right; font-weight: 600; }

  .scores { display: grid; gap: 8px; }
  .score { padding: 0; border-top: 3px solid var(--pc); overflow: hidden; }
  summary { display: flex; align-items: center; gap: 8px; padding: 12px 16px; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: '▾'; color: var(--text-3); transition: transform 0.15s; }
  details[open] summary::after { transform: rotate(180deg); }
  .name { font-family: var(--font-display); font-weight: 700; }
  .total { margin-left: auto; font-family: var(--font-display); font-weight: 900; font-size: 1.15rem; }
  .lines { list-style: none; padding: 4px 16px 12px; font-size: 0.88rem; }
  .lines li { display: flex; justify-content: space-between; padding: 3px 0; }
  .lines li span:last-child { color: var(--text-3); font-variant-numeric: tabular-nums; }
  .lines li span.pos { color: var(--good); font-weight: 700; }
  .lines .sum { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 7px; font-weight: 700; }
  .lines .sum span:last-child { color: var(--text); }
  .score p { padding: 0 16px 12px; }

  .note { margin-bottom: 10px; }
  .tips { display: grid; gap: 8px; }
  .cat { padding: 12px 14px; }
  .cat-name { font-family: var(--font-display); font-weight: 700; margin-bottom: 4px; }
  .cat ul { list-style: none; font-size: 0.9rem; }
  .cat li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; }
  .val { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
  .val.correct { color: var(--good); }
  .val.partial { color: var(--warn); }
  .val.wrong { color: var(--bad); font-weight: 500; }
  .icon { font-weight: 900; }
  .hidden-tip { font-style: italic; }

  @media (min-width: 768px) {
    .scores { grid-template-columns: repeat(3, 1fr); align-items: start; }
    .tips { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) { .tips { grid-template-columns: repeat(3, 1fr); } }
</style>
