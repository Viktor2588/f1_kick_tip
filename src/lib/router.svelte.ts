// Tiny hash router: works on GitHub Pages without 404 tricks and keeps deep links shareable.
export type Route =
  | { name: 'home' }
  | { name: 'races' }
  | { name: 'race'; round: number }
  | { name: 'tip'; round: number; sprint: boolean }
  | { name: 'tipNext' }
  | { name: 'seasonTip' }
  | { name: 'standings' }
  | { name: 'rules' }
  | { name: 'admin'; round: number | null };

export function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '');
  const [a, b, c] = path.split('/');
  const n = Number(b);
  switch (a) {
    case '': return { name: 'home' };
    case 'rennen': return Number.isFinite(n) && b ? { name: 'race', round: n } : { name: 'races' };
    case 'tipp': return Number.isFinite(n) && b ? { name: 'tip', round: n, sprint: c === 'sprint' } : { name: 'tipNext' };
    case 'saisontipp': return { name: 'seasonTip' };
    case 'tabelle': return { name: 'standings' };
    case 'regeln': return { name: 'rules' };
    case 'admin': return { name: 'admin', round: Number.isFinite(n) && b ? n : null };
    default: return { name: 'home' };
  }
}

class Router {
  route = $state<Route>(parse(location.hash));
  private depth = 0;

  constructor() {
    addEventListener('hashchange', () => {
      this.depth++;
      this.route = parse(location.hash);
      window.scrollTo({ top: 0 });
    });
  }

  go(path: string, replace = false) {
    const target = '#/' + path.replace(/^#?\/?/, '');
    if (replace) {
      history.replaceState(null, '', target);
      this.route = parse(target);
    } else location.hash = target;
  }

  back(fallback = '') {
    if (this.depth > 0) history.back();
    else this.go(fallback, true);
  }
}

export const router = new Router();
export const href = (path: string) => '#/' + path.replace(/^\//, '');
