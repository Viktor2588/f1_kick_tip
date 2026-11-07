import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { checkLogin, writeSession } from '$lib/server/auth';
import { pinHashes } from '$lib/server/config';

const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/');

export const load: PageServerLoad = ({ url }) => ({
  next: safeNext(url.searchParams.get('next')),
  devPin: pinHashes() === 'dev-default',
});

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const f = await request.formData();
    const player = String(f.get('player') ?? '');
    const pin = String(f.get('pin') ?? '');
    const res = checkLogin(player, pin);
    if (!res.ok) return fail(400, { player, error: res.error });
    writeSession(cookies, player);
    redirect(303, safeNext(String(f.get('next') ?? url.searchParams.get('next') ?? '/')));
  },
};
