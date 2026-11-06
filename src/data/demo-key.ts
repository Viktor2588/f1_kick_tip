export const DEMO_KEY = 'f1kt_demo_v1';

export function resetDemo() {
  try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
}
