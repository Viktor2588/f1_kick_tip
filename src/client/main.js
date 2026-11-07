import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { html } from './lib/html.js';
import { indexGame } from './lib/derive.js';
import { usePath, Link } from './lib/router.js';
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
  useEffect(() => {
    let alive = true;
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!alive) return;
        const offset = new Date(data.serverTime).getTime() - Date.now();
        setState({ status: 'ready', game: indexGame(data), offset });
      })
      .catch((error) => alive && setState({ status: 'error', error }));
    return () => { alive = false; };
  }, []);
  return state;
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

function Page({ path, game, now }) {
  if (path === '/') return html`<${Home} g=${game} now=${now} />`;
  if (path === '/tabelle') return html`<${Standings} g=${game} />`;
  if (path === '/rennen') return html`<${Calendar} g=${game} now=${now} />`;
  if (path === '/regeln') return html`<${Rules} />`;
  return html`<div class="empty"><p>Diese Seite gibt es nicht.</p><${Link} href="/">Zur Startseite</${Link}></div>`;
}

function App() {
  const path = usePath();
  const state = useGame();
  const now = useNow(state.offset);
  const section = '/' + (path.split('/')[1] || '');

  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  return html`
    <header class="topbar">
      <${Link} href="/" class="brand" aria-label="Kick Tip – Startseite">
        <span class="brand-mark">KT</span><span class="brand-name">Kick Tip</span><span class="brand-season">2026</span>
      </${Link}>
      <nav class="topnav" aria-label="Hauptmenü">
        ${NAV.map((n) => html`<${Link} href=${n.href} class=${section === n.href ? 'active' : ''}>${n.label}</${Link}>`)}
      </nav>
    </header>
    <main id="main">
      ${state.status === 'loading' && html`<div class="skeleton" aria-busy="true"><div></div><div></div><div></div></div>`}
      ${state.status === 'error' && html`<div class="empty"><p>Daten konnten nicht geladen werden.</p><button class="btn" onClick=${() => location.reload()}>Neu laden</button></div>`}
      ${state.status === 'ready' && html`<${Page} path=${path} game=${state.game} now=${now} />`}
    </main>
    <nav class="tabbar" aria-label="Hauptmenü">
      ${NAV.map((n) => html`
        <${Link} href=${n.href} class=${section === n.href ? 'active' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${n.icon} /></svg>
          <span>${n.label}</span>
        </${Link}>`)}
    </nav>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
