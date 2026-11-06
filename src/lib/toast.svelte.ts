export interface Toast { id: number; text: string; kind: 'good' | 'bad' | 'info' }

class Toasts {
  list = $state<Toast[]>([]);
  private seq = 0;
  show(text: string, kind: Toast['kind'] = 'info', ms = 2800) {
    const id = ++this.seq;
    this.list.push({ id, text, kind });
    setTimeout(() => (this.list = this.list.filter((t) => t.id !== id)), ms);
  }
}

export const toasts = new Toasts();

export const buzz = (pattern: number | number[] = 12) => {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
};
