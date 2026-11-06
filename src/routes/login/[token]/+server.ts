import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDb } from '$lib/server/db';
import { loginWithToken, SESSION_COOKIE } from '$lib/server/auth';

export async function GET({ params, cookies }) {
  const session = await loginWithToken(await getDb(), params.token);
  if (!session) redirect(303, '/anmelden?fehler=link');
  cookies.set(SESSION_COOKIE, session.sessionToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev,
    expires: session.expires,
  });
  redirect(303, '/');
}
