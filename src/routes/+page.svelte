<script lang="ts">
  import TopBar from '$lib/components/TopBar.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import DriverTag from '$lib/components/DriverTag.svelte';
  import { season, flag, playerById, raceByRound } from '$lib/domain/season';
  import { nextDeadline, isOpen } from '$lib/domain/schedule';
  import { clock } from '$lib/clock.svelte';
  import { fmtDayTime } from '$lib/format';

  let { data } = $props();

  const now = $derived(new Date(clock.now));
  const deadline = $derived(nextDeadline(season, now));
  const race = $derived(deadline?.race ?? null);
  const roundKey = $derived(race ? String(race.round) : '');

  const tipsFor = (kind: 'race' | 'sprint') =>
    (kind === 'race' ? data.game.raceTips[roundKey] : data.game.sprintTips[roundKey]) ?? {};
  const myRaceTip = $derived(data.viewer ? tipsFor('race')[data.viewer] : undefined);
  const mySprintTip = $derived(data.viewer ? tipsFor('sprint')[data.viewer] : undefined);
  const sprintOpen = $derived(!!race?.sprint && isOpen(race.sprintStartUTC, now));

  // Last weekend with a result, and points per player on that weekend.
  const lastRound = $derived(
    [...season.races].reverse().find((r) => data.game.raceResults[String(r.round)]) ?? null,
  );
  const lastResult = $derived(lastRound ? data.game.raceResults[String(lastRound.round)] : null);
  const weekendPoints = (pid: string, round: number) => {
    const s = data.standings.find((x) => x.playerId === pid);
    return (s?.raceScores[round]?.total ?? 0) + (s?.sprintScores[round]?.total ?? 0);
  };
  const lastWeekend = $derived(
    lastRound
      ? season.players.map((p) => ({ id: p.id, pts: weekendPoints(p.id, lastRound.round) })).sort((a, b) => b.pts - a.pts)
      : [],
  );

  // Position change caused by the last weekend.
  const prevRank = $derived.by(() => {
    if (!lastRound) return new Map<string, number>();
    const before = data.standings
      .map((s) => ({ id: s.playerId, pts: s.totalPoints - weekendPoints(s.playerId, lastRound.round) }))
      .sort((a, b) => b.pts - a.pts);
    return new Map(before.map((b, i) => [b.id, i + 1]));
  });

  const leader = $derived(data.standings[0]);
  const medal = ['🥇', '🥈', '🥉'];
</script>

<svelte:head><title>F1 Kick Tip {season.season}</title></svelte:head>

<main class="page">
  <TopBar viewer={data.viewer} />

  {#if race && deadline}
    <section class="hero" style:--flagbg="'{flag(race.countryCode)}'">
      <div class="hero-top">
        <span class="chip chip-accent">Runde {race.round} / {season.races.length}</span>
        {#if race.sprint}<span class="chip">Sprint-Wochenende</span>{/if}
      </div>
      <h1><span class="flag">{flag(race.countryCode)}</span> {race.country}</h1>
      <p class="where">{race.circuit} · {race.city}</p>

      <div class="deadline-label">
        {deadline.kind === 'sprint' ? 'Sprint-Tipps schließen in' : 'Tipps schließen in'}
      </div>
      <Countdown to={deadline.at} />

      <ul class="sessions">
        <li><span>Qualifying</span><b>{fmtDayTime(race.qualiStartUTC)}</b></li>
        {#if race.sprint && race.sprintStartUTC}<li><span>Sprint</span><b>{fmtDayTime(race.sprintStartUTC)}</b></li>{/if}
        <li><span>Rennen</span><b>{fmtDayTime(race.raceStartUTC)}</b></li>
      </ul>

      <div class="who">
        {#each season.players as p (p.id)}
          {@const done = !!tipsFor('race')[p.id]}
          <span class="who-item" class:done title={done ? `${p.name} hat getippt` : `${p.name} fehlt noch`}>
            <Avatar id={p.id} size={30} />
            <span class="mark" aria-hidden="true">{done ? '✓' : '…'}</span>
            <span class="sr-only">{p.name}: {done ? 'getippt' : 'offen'}</span>
          </span>
        {/each}
        <span class="who-text small">
          {Object.keys(tipsFor('race')).length} von {season.players.length} haben getippt
        </span>
      </div>

      {#if data.viewer}
        <div class="cta">
          <a class="btn btn-primary btn-block" href="/rennen/{race.round}#tipp">
            {myRaceTip ? 'Renntipp ansehen & ändern' : 'Jetzt Renntipp abgeben'}
          </a>
          {#if sprintOpen}
            <a class="btn btn-block" href="/rennen/{race.round}#sprint">
              {mySprintTip ? 'Sprint-Tipp ändern' : 'Sprint-Tipp abgeben'}
            </a>
          {/if}
        </div>
        <p class="mine small">
          {#if myRaceTip}<span class="chip chip-good">✓ Renntipp abgegeben</span>{:else}<span class="chip chip-part">Renntipp fehlt</span>{/if}
          {#if race.sprint}
            {#if mySprintTip}<span class="chip chip-good">✓ Sprint</span>{:else if sprintOpen}<span class="chip chip-part">Sprint fehlt</span>{/if}
          {/if}
        </p>
      {:else}
        <div class="cta"><a class="btn btn-primary btn-block" href="/login">Anmelden und tippen</a></div>
      {/if}
    </section>
  {:else}
    <section class="hero done">
      <h1>Saison {season.season} beendet 🏁</h1>
      {#if leader}
        <p class="where">Kick-Tip-Champion: <b>{playerById(leader.playerId)?.name}</b> mit {leader.totalPoints} Punkten</p>
      {/if}
    </section>
  {/if}

  <section class="section">
    <h2 class="section-title">Tabelle <a href="/tabelle">Details →</a></h2>
    <ol class="standings card">
      {#each data.standings as s, i (s.playerId)}
        {@const p = playerById(s.playerId)}
        {@const moved = (prevRank.get(s.playerId) ?? s.rank) - s.rank}
        <li>
          <span class="rank num">{s.rank}</span>
          <Avatar id={s.playerId} size={34} ring={i === 0} />
          <span class="name">
            {p?.name}
            {#if moved > 0}<span class="trend up" title="Plätze gewonnen">▲{moved}</span>{:else if moved < 0}<span class="trend down" title="Plätze verloren">▼{-moved}</span>{/if}
            <span class="sub small">{s.correctWinners} Sieger · {s.accuracy}% Quote</span>
          </span>
          <span class="pts num">
            {s.totalPoints}
            <span class="gap small">{i === 0 ? 'Pkt' : `−${leader.totalPoints - s.totalPoints}`}</span>
          </span>
        </li>
      {/each}
    </ol>
  </section>

  {#if lastRound && lastResult}
    <section class="section">
      <h2 class="section-title">
        Zuletzt: {flag(lastRound.countryCode)} {lastRound.country}
        <a href="/rennen/{lastRound.round}">Auswertung →</a>
      </h2>
      <a class="card recap" href="/rennen/{lastRound.round}">
        <div class="podium">
          {#each lastResult.podium as id, i}
            <div class="step s{i + 1}">
              <span class="pos">P{i + 1}</span>
              <DriverTag {id} full />
            </div>
          {/each}
        </div>
        <ul class="weekend">
          {#each lastWeekend as w, i (w.id)}
            <li>
              <span>{i < 3 && w.pts > 0 ? medal[i] : ''}</span>
              <Avatar id={w.id} size={24} />
              <span class="name">{playerById(w.id)?.name}</span>
              <b class="num">+{w.pts}</b>
            </li>
          {/each}
        </ul>
      </a>
    </section>
  {/if}
</main>

<style>
  .hero {
    position: relative;
    overflow: hidden;
    margin-top: 12px;
    padding: 20px 18px 18px;
    border-radius: 22px;
    color: #fff;
    background:
      radial-gradient(120% 90% at 100% 0%, rgb(255 255 255 / 0.12), transparent 55%),
      linear-gradient(150deg, #e10600 0%, #8f0400 55%, #2a0a0a 100%);
    box-shadow: 0 18px 40px rgb(225 6 0 / 0.25);
  }
  .hero::after {
    content: var(--flagbg);
    position: absolute; right: -18px; top: -30px;
    font-size: 150px; opacity: 0.16; transform: rotate(12deg);
    pointer-events: none;
  }
  .hero.done { background: linear-gradient(150deg, #1d2230, #0b0c10); box-shadow: var(--shadow); }
  .hero-top { display: flex; gap: 6px; flex-wrap: wrap; }
  .hero .chip { background: rgb(0 0 0 / 0.25); color: #fff; }
  .hero h1 { font-size: 2.1rem; font-weight: 900; margin-top: 12px; letter-spacing: -0.01em; }
  .flag { font-size: 1.8rem; }
  .where { margin: 2px 0 16px; opacity: 0.85; }
  .deadline-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.85; margin-bottom: 6px; font-weight: 700; }
  .sessions { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 4px; font-size: 0.9rem; }
  .sessions li { display: flex; justify-content: space-between; border-bottom: 1px solid rgb(255 255 255 / 0.12); padding: 4px 0; }
  .sessions span { opacity: 0.8; }
  .who { display: flex; align-items: center; gap: 6px; margin-top: 16px; flex-wrap: wrap; }
  .who-item { position: relative; display: inline-flex; }
  .who-item:not(.done) :global(.av) { filter: grayscale(1); opacity: 0.55; }
  .mark {
    position: absolute; right: -4px; bottom: -4px; width: 16px; height: 16px; border-radius: 50%;
    display: grid; place-items: center; font-size: 0.65rem; font-weight: 900;
    background: #fff; color: #8f0400;
  }
  .who-item.done .mark { background: var(--good); color: #fff; }
  .who-text { opacity: 0.85; margin-left: 6px; }
  .cta { display: grid; gap: 8px; margin-top: 16px; }
  .hero .btn-primary { background: #fff; color: #b00500; border-color: #fff; }
  .hero .btn:not(.btn-primary) { background: rgb(0 0 0 / 0.25); border-color: rgb(255 255 255 / 0.2); color: #fff; }
  .mine { display: flex; gap: 6px; margin: 12px 0 0; flex-wrap: wrap; }
  .hero .chip-good { background: rgb(34 197 94 / 0.9); color: #fff; }
  .hero .chip-part { background: rgb(0 0 0 / 0.35); color: #ffe08a; }

  .standings { list-style: none; margin: 0; padding: 4px 14px; }
  .standings li { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
  .standings li + li { border-top: 1px solid var(--line); }
  .rank { width: 1.4ch; font-weight: 900; font-size: 1.2rem; color: var(--text-3); text-align: center; }
  .standings li:first-child .rank { color: var(--gold); }
  .name { flex: 1; font-weight: 700; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; }
  .sub { flex-basis: 100%; color: var(--text-3); font-weight: 400; }
  .trend { font-size: 0.72rem; font-weight: 900; }
  .trend.up { color: var(--good); }
  .trend.down { color: var(--bad); }
  .pts { font-size: 1.5rem; font-weight: 900; text-align: right; line-height: 1; display: flex; flex-direction: column; align-items: flex-end; }
  .gap { color: var(--text-3); font-weight: 600; margin-top: 2px; }

  .recap { display: block; text-decoration: none; }
  .podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .step { background: var(--surface-2); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .step :global(.tag) { overflow: hidden; text-overflow: ellipsis; font-size: 0.92rem; letter-spacing: 0; }
  .pos { font-size: 0.72rem; font-weight: 900; color: var(--text-3); }
  .s1 .pos { color: var(--gold); }
  .s2 .pos { color: var(--silver); }
  .s3 .pos { color: var(--bronze); }
  .weekend { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
  .weekend li { display: grid; grid-template-columns: 1.4em auto 1fr auto; align-items: center; gap: 8px; }
  .weekend .name { font-weight: 600; }
  .weekend b { font-size: 1.1rem; }
</style>
