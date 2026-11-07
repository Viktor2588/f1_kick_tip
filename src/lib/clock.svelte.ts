// A ticking clock aligned to the server's notion of "now" (which tests/previews can override).
let skew = 0;
let started = false;
export const clock = $state({ now: Date.now() });

export function syncClock(serverNowIso: string) {
  skew = Date.parse(serverNowIso) - Date.now();
  clock.now = Date.now() + skew;
  if (!started && typeof window !== 'undefined') {
    started = true;
    setInterval(() => (clock.now = Date.now() + skew), 1000);
  }
}
