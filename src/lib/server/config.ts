import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { fileStore } from './store/file';
import { neonStore } from './store/neon';
import type { Store } from './store/types';

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const source = env.DATA_SOURCE ?? (env.DATABASE_URL ? 'neon' : 'file');
  if (source === 'neon') {
    if (!env.DATABASE_URL) throw new Error('DATA_SOURCE=neon braucht DATABASE_URL');
    store = neonStore(env.DATABASE_URL);
  } else {
    store = fileStore(env.DATA_DIR ?? '.data/dev', env.DATA_SEED ?? 'fixtures/dev/game.json');
  }
  return store;
}

export const isFileMode = () => (env.DATA_SOURCE ?? (env.DATABASE_URL ? 'neon' : 'file')) === 'file';

/** Current time; overridable for previews and tests. */
export function now(): Date {
  return env.NOW_OVERRIDE ? new Date(env.NOW_OVERRIDE) : new Date();
}

export function sessionSecret(): string {
  const s = env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (dev || isFileMode()) return 'dev-only-insecure-secret';
  throw new Error('SESSION_SECRET fehlt oder ist zu kurz (min. 16 Zeichen)');
}

/** PIN hashes per player. In file mode without config, every player uses PIN 0000. */
export function pinHashes(): Record<string, string> | 'dev-default' | null {
  if (env.PLAYER_PINS) {
    try {
      return JSON.parse(env.PLAYER_PINS);
    } catch {
      throw new Error('PLAYER_PINS ist kein gültiges JSON');
    }
  }
  return isFileMode() ? 'dev-default' : null;
}

export function admins(): string[] {
  return (env.ADMIN_PLAYERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}
