import type { Handle } from '@sveltejs/kit';

// Login comes in slice 3. Until then nobody is signed in.
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.player = null;
  return resolve(event);
};
