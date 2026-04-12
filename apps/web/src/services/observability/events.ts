// Product analytics events allowed from the web client. OTel-only events are
// intentionally excluded from `AnalyticsEventName` below to prevent misuse.
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
  scanner_permission_prompted: {
    owner: 'posthog',
    description: 'Tracks when scanner camera permission is requested.',
  },
  scanner_permission_granted: {
    owner: 'posthog',
    description: 'Tracks when scanner camera permission is granted.',
  },
  scanner_permission_denied: {
    owner: 'posthog',
    description: 'Tracks when scanner camera permission is denied.',
  },
  scanner_unsupported: {
    owner: 'posthog',
    description: 'Tracks unsupported camera/decode capability on the client.',
  },
  scanner_decode_success: {
    owner: 'posthog',
    description: 'Tracks successful QR decode events prior to submission.',
  },
  scanner_decode_failure: {
    owner: 'posthog',
    description: 'Tracks decode failures while camera is running.',
  },
  scanner_submit_success: {
    owner: 'posthog',
    description: 'Tracks successful scan submission outcomes.',
  },
  scanner_submit_failed: {
    owner: 'posthog',
    description: 'Tracks failed scan submission attempts.',
  },
  scanner_blocked: {
    owner: 'posthog',
    description: 'Tracks blocked scan outcomes such as race pause or QR disabled.',
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
  | 'scanner_permission_prompted'
  | 'scanner_permission_granted'
  | 'scanner_permission_denied'
  | 'scanner_unsupported'
  | 'scanner_decode_success'
  | 'scanner_decode_failure'
  | 'scanner_submit_success'
  | 'scanner_submit_failed'
  | 'scanner_blocked'
>;

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;
