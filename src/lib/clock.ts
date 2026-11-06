// App clock. In demo mode `?now=2026-11-08T12:00:00Z` shifts time (it keeps ticking),
// which makes every deadline state reachable for testing. Live mode always uses real time,
// and tip timestamps in live mode are never taken from here.
let offset = 0;

export const clock = {
  now: () => Date.now() + offset,
  allowOverride() {
    const raw = new URLSearchParams(location.search).get('now') ?? new URLSearchParams(location.hash.split('?')[1] ?? '').get('now');
    const target = raw ? Date.parse(raw) : NaN;
    if (!Number.isNaN(target)) offset = target - Date.now();
  },
  get simulated() {
    return offset !== 0;
  },
};
