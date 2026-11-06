import { error } from '@sveltejs/kit';

/** Form actions don't run layout loads, so every admin action checks again. */
export function requireAdmin(locals: App.Locals) {
  if (!locals.player?.isAdmin) error(403, 'Nur für Admins');
  return locals.player;
}
