const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const DEFAULT_SERVICE_NAME = 'velocity-gp-web';
const DEFAULT_TRACE_SAMPLING_RATE = 1;

function parseBoolean(value: boolean | string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return value === 'true';
}

function parseTraceSamplingRate(
  value: string | number | undefined,
  fallback = DEFAULT_TRACE_SAMPLING_RATE
) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export const observabilityConfig = {
  debug: parseBoolean(import.meta.env.VITE_OBSERVABILITY_DEBUG, import.meta.env.DEV),
  posthogApiKey: import.meta.env.VITE_POSTHOG_API_KEY || import.meta.env.VITE_POSTHOG_KEY || '',
  posthogHost: import.meta.env.VITE_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
  serviceName: import.meta.env.VITE_OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME,
  // Sampling rate is currently consumed by tracer bootstrap integration.
  traceSamplingRate: parseTraceSamplingRate(import.meta.env.VITE_OTEL_TRACE_SAMPLING_RATE),
};

export function isAnalyticsEnabled() {
  return Boolean(observabilityConfig.posthogApiKey);
}
