import type { Handle } from '@sveltejs/kit';
import { isAdmin, readSession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const playerId = readSession(event.cookies);
  event.locals.playerId = playerId;
  event.locals.isAdmin = isAdmin(playerId);
  const response = await resolve(event);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
};
