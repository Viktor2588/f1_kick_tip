<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { href } from '../lib/router.svelte';
  import { nextRace, awaitingResult, sprintPhase, seasonTipOpen } from '../domain/season';
  import { flag, formatDayTime, relative, plural } from '../lib/format';
  import Countdown from '../ui/Countdown.svelte';
  import Avatar from '../ui/Avatar.svelte';
  import DriverTag from '../ui/DriverTag.svelte';
  import Standings from '../ui/StandingsMini.svelte';

  const next = $derived(nextRace(app.season, app.snap, app.now));
  const waiting = $derived(awaitingResult(app.season, app.snap, app.now));
  const lastScored = $derived([...app.season.races].reverse().find((r) => app.snap.raceResults[r.round]) ?? null);

  const myTip = $derived(next && app.me ? app.snap.raceTips[next.round]?.[app.me] : undefined);
  const sprintOpen = $derived(next ? sprintPhase(next, app.snap, app.now) === 'open' : false);
  const mySprint = $derived(next && app.me ? app.snap.sprintTips[next.round]?.[app.me] : undefined);
  const tippedBy = (round: number) => app.snap.raceTips[round] ?? {};

  const me = $derived(app.standings.find((s) => s.playerId === app.me));
  const leader = $derived(app.standings[0]);
  const rankLine = $derived.by(() => {
    if (!me || !leader) return '';
    if (me.rank === 1) {
      const second = app.standings.find((s) => s.playerId !== me.playerId);
      const gap = second ? me.total - second.total : 0;
      return gap > 0 ? `Du führst mit ${plural(gap, 'Punkt', 'Punkten')} Vorsprung.` : 'Du teilst dir die Spitze.';
    }
    const gap = leader.total - me.total;
    return `Platz ${me.rank} · ${plural(gap, 'Punkt', 'Punkte')} hinter ${app.playerById(leader.playerId)?.name}.`;
  });

  const lastScores = $derived(
    lastScored
      ? app.standings
          .map((s) => ({ id: s.playerId, pts: (s.raceScores[lastScored.round]?.total ?? null) as number | null, sprint: s.sprintScores[lastScored.round]?.total ?? 0 }))
          .sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1))
      : [],
  );
  const lastResult = $derived(lastScored ? app.snap.raceResults[lastScored.round] : null);
</script>

<div class="page stack">
  {#if app.player}
    <div class="hello rise">
      <h1>Servus {app.player.name} {app.player.emoji}</h1>
      {#if rankLine}<p class="muted">{rankLine}</p>{/if}
    </div>
  {/if}

  {#if next}
    <a class="hero rise" href={href(`rennen/${next.round}`)}>
      <div class="eyebrow tiny">
        <span>Runde {next.round} · Nächstes Rennen</span>
        {#if next.sprint}<span class="chip sprint">Sprint</span>{/if}
      </div>
      <h2><span class="flag">{flag(next.countryCode)}</span> {next.name.replace('Großer Preis', 'GP')}</h2>
      <p class="meta">
        {next.circuit}<br />
        {#if next.qualiStartUTC}<span class="nowrap">Quali {formatDayTime(next.qualiStartUTC)}</span> · {/if}<span class="nowrap">Rennen {formatDayTime(next.raceStartUTC)}</span>
      </p>
      <div class="cd-label tiny">Tippschluss beim Rennstart</div>
      <Countdown target={next.raceStartUTC} />
      <div class="who">
        {#each app.season.players as p (p.id)}
          <Avatar id={p.id} size={30} dim={!tippedBy(next.round)[p.id]} />
        {/each}
        <span class="small">{Object.keys(tippedBy(next.round)).length} von {app.season.players.length} haben getippt</span>
      </div>
    </a>

    {#if app.me}
      {#if sprintOpen && next.sprintStartUTC}
        <a class="cta card rise" class:done={!!mySprint} href={href(`tipp/${next.round}/sprint`)}>
          <span class="chip sprint">Sprint</span>
          <span class="grow">
            <strong>{mySprint ? 'Sprint-Tipp steht' : 'Sprint-Tipp fehlt'}</strong>
            <span class="small muted">Schluss {relative(next.sprintStartUTC, app.now)}</span>
          </span>
          <span class="go">{mySprint ? 'Ändern' : 'Tippen'} ›</span>
        </a>
      {/if}
      {#if myTip}
        <a class="cta card done rise" href={href(`tipp/${next.round}`)}>
          <span class="check" aria-hidden="true">✓</span>
          <span class="grow">
            <strong>Dein Tipp steht</strong>
            <span class="podium small">
              <DriverTag id={myTip.p1} /> <DriverTag id={myTip.p2} /> <DriverTag id={myTip.p3} />
            </span>
          </span>
          <span class="go">Ändern ›</span>
        </a>
      {:else}
        <a class="btn primary block big rise" href={href(`tipp/${next.round}`)}>Jetzt tippen · {relative(next.raceStartUTC, app.now)} Schluss</a>
      {/if}
    {/if}
  {:else}
    <div class="card empty">
      <div class="big">🏁</div>
      <strong>Saison vorbei.</strong>
      <p class="small">Danke fürs Mitspielen. Die Endtabelle steht unter Tabelle.</p>
    </div>
  {/if}

  {#if waiting}
    <a class="card waiting rise" href={href(`rennen/${waiting.round}`)}>
      <span class="flag">{flag(waiting.countryCode)}</span>
      <span class="grow">
        <strong>{waiting.country}: Ergebnis folgt</strong>
        <span class="small muted">Wird montags früh eingetragen. Die Tipps sind schon aufgedeckt.</span>
      </span>
      <span class="go">›</span>
    </a>
  {/if}

  <div class="section-title">Tabelle <a href={href('tabelle')}>Alles ›</a></div>
  <Standings />

  {#if lastScored && lastResult}
    <div class="section-title">Letztes Rennen <a href={href(`rennen/${lastScored.round}`)}>Details ›</a></div>
    <a class="card last" href={href(`rennen/${lastScored.round}`)}>
      <div class="row between">
        <strong>{flag(lastScored.countryCode)} {lastScored.name.replace('Großer Preis', 'GP')}</strong>
        <span class="faint small">R{lastScored.round}</span>
      </div>
      <ol class="res">
        <li><span class="pos p1">1</span><DriverTag id={lastResult.p1} /></li>
        <li><span class="pos p2">2</span><DriverTag id={lastResult.p2} /></li>
        <li><span class="pos p3">3</span><DriverTag id={lastResult.p3} /></li>
      </ol>
      <div class="scores">
        {#each lastScores as s, i (s.id)}
          <div class="sc" class:top={i === 0 && (s.pts ?? 0) > 0}>
            <Avatar id={s.id} size={28} />
            <span class="num"><strong>{s.pts ?? '–'}</strong>{#if s.sprint} <span class="faint small">+{s.sprint}</span>{/if}</span>
          </div>
        {/each}
      </div>
    </a>
  {/if}

  {#if seasonTipOpen(app.season, app.now)}
    <a class="btn block" href={href('saisontipp')}>Saison-Tipp abgeben (Weltmeister)</a>
  {/if}
</div>

<style>
  .hello h1 { font-size: 26px; font-weight: 900; letter-spacing: -0.01em; }
  .hero {
    position: relative; overflow: hidden; display: block; color: #fff;
    border-radius: 22px; padding: 18px 16px 16px;
    background:
      radial-gradient(120% 90% at 100% 0%, rgb(255 80 60 / 0.55), transparent 60%),
      repeating-linear-gradient(135deg, rgb(255 255 255 / 0.03) 0 8px, transparent 8px 16px),
      linear-gradient(160deg, #b80500, #5c0300 70%, #2a0200);
    box-shadow: 0 16px 40px rgb(140 4 0 / 0.35);
  }
  .eyebrow { display: flex; justify-content: space-between; align-items: center; opacity: 0.9; }
  .hero h2 { font-size: 27px; line-height: 1.1; font-weight: 900; margin: 8px 0 6px; letter-spacing: -0.01em; }
  .flag { font-size: 1.05em; }
  .meta { font-size: 14px; opacity: 0.85; margin-bottom: 14px; }
  .nowrap { white-space: nowrap; }
  .cd-label { opacity: 0.8; margin-bottom: 6px; }
  .who { display: flex; align-items: center; gap: 6px; margin-top: 14px; }
  .who .small { margin-left: 6px; opacity: 0.9; }
  .big { min-height: 56px; font-size: 17px; }
  .cta { display: flex; align-items: center; gap: 12px; }
  .cta strong { display: block; }
  .cta.done { border-color: color-mix(in srgb, var(--good) 40%, var(--line)); }
  .check { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--good-soft); color: var(--good); font-weight: 900; }
  .podium { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
  .go { color: var(--accent-2); font-weight: 700; white-space: nowrap; }
  .waiting { display: flex; gap: 12px; align-items: center; }
  .waiting .flag { font-size: 28px; }
  .waiting strong { display: block; }
  .last { display: block; }
  .res { list-style: none; padding: 0; margin: 12px 0; display: flex; flex-direction: column; gap: 8px; }
  .res li { display: flex; align-items: center; gap: 10px; }
  .pos { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-weight: 900; font-size: 13px; color: #111; }
  .p1 { background: var(--gold); } .p2 { background: var(--silver); } .p3 { background: var(--bronze); }
  .scores { display: flex; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
  .sc { flex: 1; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px; background: var(--surface-2); }
  .sc strong { font-size: 18px; }
  .sc.top { background: var(--good-soft); }
  .sc.top strong { color: var(--good); }
</style>
