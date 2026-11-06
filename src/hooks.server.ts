import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { playerForSession, SESSION_COOKIE } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE);
  event.locals.player = token ? await playerForSession(await getDb(), token) : null;
  return resolve(event);
};
