import { initializeAnalytics, trackAnalyticsEvent, identifyAnalyticsUser } from './analytics';
import { analyticsEventCatalog } from './events';
import { captureTelemetryError, withTelemetrySpan } from './telemetry';

let observabilityInitialized = false;

export function initializeObservability() {
  if (observabilityInitialized) {
    return;
  }

  initializeAnalytics();
  attachGlobalErrorHandlers();
  observabilityInitialized = true;
}

function attachGlobalErrorHandlers() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    captureTelemetryError(event.error ?? new Error(event.message), {
      'error.type': 'window.error',
      'error.filename': event.filename,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureTelemetryError(event.reason, {
      'error.type': 'window.unhandledrejection',
    });
  });
}

export {
  analyticsEventCatalog,
  captureTelemetryError,
  identifyAnalyticsUser,
  trackAnalyticsEvent,
  withTelemetrySpan,
};
