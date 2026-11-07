import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!locals.playerId) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
  if (!locals.isAdmin) error(403, 'Nur für Admins');
};
