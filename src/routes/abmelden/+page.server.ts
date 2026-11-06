import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { endSession, SESSION_COOKIE } from '$lib/server/auth';

export const actions = {
  default: async ({ cookies }) => {
    await endSession(await getDb(), cookies.get(SESSION_COOKIE));
    cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev });
    redirect(303, '/');
  },
};

export function load() {
  redirect(303, '/');
}
