// PIN login with a signed, long-lived cookie. No accounts, no passwords to forget:
// each player has a short PIN, the hash lives in an env var on the server.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { season } from '$lib/domain/season';
import { admins, pinHashes, sessionSecret } from './config';

export const COOKIE = 'f1kt_session';
const MAX_AGE_S = 60 * 60 * 24 * 365;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sign = (payload: string) => createHmac('sha256', sessionSecret()).update(payload).digest('base64url');

export function readSession(cookies: Cookies): string | null {
  const raw = cookies.get(COOKIE);
  if (!raw) return null;
  const [pid, exp, sig] = raw.split('.');
  if (!pid || !exp || !sig) return null;
  const expected = sign(`${pid}.${exp}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return season.players.some((p) => p.id === pid) ? pid : null;
}

export function writeSession(cookies: Cookies, playerId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  cookies.set(COOKIE, `${playerId}.${exp}.${sign(`${playerId}.${exp}`)}`, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE_S,
  });
}

export function clearSession(cookies: Cookies) {
  cookies.delete(COOKIE, { path: '/' });
}

export const isAdmin = (playerId: string | null) => !!playerId && admins().includes(playerId);

// Brute-force brake: 5 wrong PINs per player per 10 minutes.
const attempts = new Map<string, { count: number; until: number }>();

export type LoginResult = { ok: true } | { ok: false; error: string };

export function checkLogin(playerId: string, pin: string): LoginResult {
  if (!season.players.some((p) => p.id === playerId)) return { ok: false, error: 'Unbekannter Spieler' };
  const hashes = pinHashes();
  if (!hashes) return { ok: false, error: 'Login ist auf dem Server nicht eingerichtet (PLAYER_PINS fehlt)' };

  const a = attempts.get(playerId);
  if (a && a.count >= 5 && a.until > Date.now()) {
    return { ok: false, error: 'Zu viele Versuche. Bitte in ein paar Minuten nochmal.' };
  }
  const ok = hashes === 'dev-default' ? pin === '0000' : !!hashes[playerId] && verifyPin(pin, hashes[playerId]);
  if (ok) {
    attempts.delete(playerId);
    return { ok: true };
  }
  const next = a && a.until > Date.now() ? a.count + 1 : 1;
  attempts.set(playerId, { count: next, until: Date.now() + 10 * 60_000 });
  return { ok: false, error: 'PIN stimmt nicht' };
}
