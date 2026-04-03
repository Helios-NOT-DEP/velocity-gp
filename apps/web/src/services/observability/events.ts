export const analyticsEventCatalog = {
  page_viewed: {
    owner: 'posthog',
    description: 'Captures route-level navigation for product usage and funnel analysis.',
  },
  auth_login_submitted: {
    owner: 'posthog',
    description: 'Tracks the start of the player login flow.',
  },
  helios_role_enabled: {
    owner: 'posthog',
    description: 'Tracks when a participant becomes the Helios player persona.',
  },
  team_created: {
    owner: 'posthog',
    description: 'Tracks team creation and garage completion.',
  },
  qr_scan_recorded: {
    owner: 'posthog',
    description: 'Tracks successful in-app scan submissions and awarded points.',
  },
  pit_stop_started: {
    owner: 'posthog',
    description: 'Tracks when a team enters pit-stop lockout.',
  },
  pit_stop_cleared: {
    owner: 'posthog',
    description: 'Tracks manual or automatic pit-stop completion.',
  },
  api_request_completed: {
    owner: 'otel',
    description: 'Backend/API request timing belongs in traces and metrics, not product analytics.',
  },
  api_request_failed: {
    owner: 'otel',
    description: 'Failed backend/API requests belong in traces and metrics for alerting.',
  },
  ui_error_captured: {
    owner: 'otel',
    description: 'Unhandled UI/runtime failures belong in telemetry for troubleshooting.',
  },
} as const;

export type AnalyticsEventName = Extract<
  keyof typeof analyticsEventCatalog,
  | 'page_viewed'
  | 'auth_login_submitted'
  | 'helios_role_enabled'
  | 'team_created'
  | 'qr_scan_recorded'
  | 'pit_stop_started'
  | 'pit_stop_cleared'
>;

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;
