// Passwordless login: each player gets a personal link containing a random token.
// Only SHA-256 hashes of tokens are stored; the raw token exists only in the link and the cookie.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from './db';
import * as t from './db/schema';

export const SESSION_COOKIE = 'f1kt_session';
export const SESSION_DAYS = 180;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

/** Creates (or replaces) a player's personal login token and returns the raw token. */
export async function issueLoginToken(db: Db, playerId: string): Promise<string> {
  const token = newToken();
  const updated = await db.update(t.players).set({ loginTokenHash: hash(token) }).where(eq(t.players.id, playerId)).returning({ id: t.players.id });
  if (updated.length === 0) throw new Error(`Unknown player: ${playerId}`);
  return token;
}

/** Login link token → new session token, or null if the link is unknown. */
export async function loginWithToken(db: Db, token: string): Promise<{ sessionToken: string; playerId: string; expires: Date } | null> {
  if (!token || token.length < 20) return null;
  const [player] = await db.select({ id: t.players.id }).from(t.players).where(eq(t.players.loginTokenHash, hash(token)));
  if (!player) return null;
  const sessionToken = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(t.sessions).values({ tokenHash: hash(sessionToken), playerId: player.id, expiresAt: expires });
  return { sessionToken, playerId: player.id, expires };
}

export async function playerForSession(db: Db, sessionToken: string | undefined) {
  if (!sessionToken) return null;
  const [row] = await db
    .select({ id: t.players.id, name: t.players.name, isAdmin: t.players.isAdmin })
    .from(t.sessions)
    .innerJoin(t.players, eq(t.players.id, t.sessions.playerId))
    .where(and(eq(t.sessions.tokenHash, hash(sessionToken)), gt(t.sessions.expiresAt, new Date())));
  return row ?? null;
}

export async function endSession(db: Db, sessionToken: string | undefined) {
  if (sessionToken) await db.delete(t.sessions).where(eq(t.sessions.tokenHash, hash(sessionToken)));
}
