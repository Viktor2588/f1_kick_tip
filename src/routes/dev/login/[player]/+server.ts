// Local development only: sign in as a player without a link (http://localhost:5180/dev/login/thomas).
// Disabled in production builds.
import { error, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { issueLoginToken } from '$lib/server/auth';

export async function GET({ params }) {
  if (!dev) error(404, 'Not found');
  let token: string;
  try {
    token = await issueLoginToken(await getDb(), params.player);
  } catch {
    error(404, 'Unbekannter Spieler');
  }
  redirect(303, `/login/${token}`);
}
