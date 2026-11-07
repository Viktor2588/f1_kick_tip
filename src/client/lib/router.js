// Minimal History-API router: internal links update the path without a reload.
import { useEffect, useState } from 'preact/hooks';
import { html } from './html.js';

const listeners = new Set();
const current = () => location.pathname.replace(/\/+$/, '') || '/';

export function navigate(to, { replace = false } = {}) {
  if (to === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', () => listeners.forEach((l) => l()));

export function usePath() {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const l = () => setPath(current());
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return path;
}

export function Link({ href, children, ...rest }) {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return html`<a href=${href} onClick=${onClick} ...${rest}>${children}</a>`;
}
