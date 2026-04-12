import posthog from 'posthog-js';

import { type AnalyticsEventName, type AnalyticsProperties } from './events';
import { observabilityConfig } from './config';

let analyticsInitialized = false;

function toProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined));
}

export function initializeAnalytics() {
  if (analyticsInitialized || !observabilityConfig.posthogApiKey || typeof window === 'undefined') {
    return;
  }

  posthog.init(observabilityConfig.posthogApiKey, {
    api_host: observabilityConfig.posthogHost,
    // Route tracking is emitted manually from router observer for consistent screen names.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage+cookie',
    loaded: (instance) => {
      if (observabilityConfig.debug) {
        instance.debug();
      }
    },
  });

  analyticsInitialized = true;
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties
) {
  if (!analyticsInitialized) {
    // Fail open in local/test environments where analytics is intentionally disabled.
    return;
  }

  posthog.capture(eventName, toProperties(properties));
}

export function identifyAnalyticsUser(distinctId: string, properties?: AnalyticsProperties) {
  if (!analyticsInitialized) {
    return;
  }

  posthog.identify(distinctId, toProperties(properties));
}

export function resetAnalyticsUser() {
  if (!analyticsInitialized) {
    return;
  }

  posthog.reset();
}
