import type { Router } from 'react-router';

import { trackAnalyticsEvent } from './analytics';

const routeLabels: Record<string, string> = {
  '/': 'login',
  '/team-setup': 'team-setup',
  '/race': 'race',
  // Alias routes intentionally map to canonical labels for consistent analytics.
  '/garage': 'team-setup',
  '/race-hub': 'race',
  '/pit-stop': 'pit-stop',
  '/helios': 'helios',
  '/leaderboard': 'leaderboard',
  '/victory-lane': 'victory-lane',
};

function trackRoute(pathname: string) {
  trackAnalyticsEvent('page_viewed', {
    path: pathname,
    screen_name: routeLabels[pathname] ?? pathname,
  });
}

export function observeRouter(router: Router) {
  // Deduplicates route events because router subscriptions can fire repeatedly
  // during redirects and state-only transitions.
  let previousPathname: string | null = null;

  const emitCurrentRoute = () => {
    const pathname = router.state.location.pathname;
    if (pathname === previousPathname) {
      return;
    }

    previousPathname = pathname;
    trackRoute(pathname);
  };

  emitCurrentRoute();
  return router.subscribe(emitCurrentRoute);
}
