import { error } from '@sveltejs/kit';

export function load({ locals }) {
  if (!locals.player?.isAdmin) error(403, 'Nur für Admins');
  return {};
}
