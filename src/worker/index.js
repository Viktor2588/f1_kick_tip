// F1 Kick Tip – Cloudflare Worker entry. Logic lives in app.js.
import { handle } from './app.js';

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: 'Serverfehler' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
  },
};
