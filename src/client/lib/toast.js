// Tiny toast notifications.
import { useEffect, useState } from 'preact/hooks';
import { html } from './html.js';

const listeners = new Set();
let seq = 0;

export function toast(text, kind = 'ok') {
  const t = { id: ++seq, text, kind };
  listeners.forEach((l) => l(t));
}

export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const l = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3500);
    };
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return html`<div class="toasts" role="status" aria-live="polite">
    ${items.map((t) => html`<div key=${t.id} class=${`toast toast-${t.kind}`}>${t.text}</div>`)}
  </div>`;
}
