import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { html } from './lib/html.js';
import { indexGame } from './lib/derive.js';
import { usePath, Link, navigate } from './lib/router.js';
import { Toasts, toast } from './lib/toast.js';
import { Race } from './views/race.js';
import { Admin } from './views/admin.js';
import { Home } from './views/home.js';
import { Standings } from './views/standings.js';
import { Calendar } from './views/calendar.js';
import { Rules } from './views/rules.js';

const NAV = [
  { href: '/', label: 'Start', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { href: '/rennen', label: 'Rennen', icon: 'M4 21V4m0 0h13l-2 4 2 4H4' },
  { href: '/tabelle', label: 'Tabelle', icon: 'M5 20V10m7 10V4m7 16v-7' },
  { href: '/regeln', label: 'Regeln', icon: 'M6 4h10l4 4v12H6zM9 12h8M9 16h8' },
];

function useGame() {
  const [state, setState] = useState({ status: 'loading' });
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/state');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const offset = new Date(data.serverTime).getTime() - Date.now();
      setState({ status: 'ready', game: indexGame(data), me: data.me, offset });
    } catch (error) {
      setState((s) => (s.status === 'ready' ? s : { status: 'error', error }));
      throw error;
    }
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  return { ...state, reload: load };
}

/** Current time corrected to the server clock, ticking every second. */
function useNow(offset = 0) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [offset]);
  return now;
}

function Page({ path, game, me, now, reload }) {
  if (path === '/') return html`<${Home} g=${game} me=${me} now=${now} />`;
  if (path === '/tabelle') return html`<${Standings} g=${game} me=${me} now=${now} reload=${reload} />`;
  if (path === '/rennen') return html`<${Calendar} g=${game} now=${now} />`;
  const m = path.match(/^\/rennen\/(\d+)$/);
  if (m) return html`<${Race} g=${game} round=${Number(m[1])} me=${me} now=${now} reload=${reload} />`;
  if (path === '/regeln') return html`<${Rules} />`;
  if (path === '/admin') return html`<${Admin} g=${game} me=${me} now=${now} reload=${reload} />`;
  return html`<div class="empty"><p>Diese Seite gibt es nicht.</p><${Link} href="/">Zur Startseite</${Link}></div>`;
}

function Me({ me }) {
  const [open, setOpen] = useState(false);
  if (!me) return null;
  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/';
  };
  return html`<div class="me">
    <button class="me-btn" style=${`--pc:${me.color}`} aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="player-dot" aria-hidden="true">${me.emoji}</span><span class="me-name">${me.name}</span>
    </button>
    ${open && html`<div class="me-menu">
      <p class="small muted">Angemeldet als ${me.name} auf diesem Gerät.</p>
      ${me.isAdmin && html`<${Link} href="/admin" class="btn btn-ghost btn-sm" onClick=${() => setOpen(false)}>Admin</${Link}>`}
      <button class="btn btn-ghost btn-sm" onClick=${logout}>Abmelden</button>
    </div>`}
  </div>`;
}

/** One-time notices from the join link redirect. */
function useArrivalNotice(me, status) {
  useEffect(() => {
    if (status !== 'ready') return;
    const q = new URLSearchParams(location.search);
    if (q.has('willkommen') && me) toast(`Hallo ${me.name}! Du bist jetzt angemeldet.`);
    if (q.get('link') === 'ungueltig') toast('Dieser Link ist ungültig oder wurde ersetzt.', 'error');
    if (q.has('willkommen') || q.has('link')) navigate(location.pathname, { replace: true });
  }, [status]);
}

function App() {
  const path = usePath();
  const state = useGame();
  const now = useNow(state.offset);
  const section = '/' + (path.split('/')[1] || '');
  useArrivalNotice(state.me, state.status);

  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  return html`
    <header class="topbar">
      <${Link} href="/" class="brand" aria-label="Kick Tip – Startseite">
        <span class="brand-mark">KT</span><span class="brand-name">Kick Tip</span><span class="brand-season">2026</span>
      </${Link}>
      <nav class="topnav" aria-label="Hauptmenü">
        ${NAV.map((n) => html`<${Link} href=${n.href} class=${section === n.href ? 'active' : ''}>${n.label}</${Link}>`)}
      </nav>
      <${Me} me=${state.me} />
    </header>
    <main id="main">
      ${state.status === 'loading' && html`<div class="skeleton" aria-busy="true"><div></div><div></div><div></div></div>`}
      ${state.status === 'error' && html`<div class="empty"><p>Daten konnten nicht geladen werden.</p><button class="btn" onClick=${() => location.reload()}>Neu laden</button></div>`}
      ${state.status === 'ready' && html`<${Page} path=${path} game=${state.game} me=${state.me} now=${now} reload=${state.reload} />`}
    </main>
    <nav class="tabbar" aria-label="Hauptmenü">
      ${NAV.map((n) => html`
        <${Link} href=${n.href} class=${section === n.href ? 'active' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${n.icon} /></svg>
          <span>${n.label}</span>
        </${Link}>`)}
    </nav>
    <${Toasts} />
  `;
}

render(html`<${App} />`, document.getElementById('app'));
