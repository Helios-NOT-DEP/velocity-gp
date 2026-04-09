import { describe, expect, it } from 'vitest';

import { analyticsEventCatalog } from '@/services/observability';

describe('analyticsEventCatalog', () => {
  it('keeps product analytics and telemetry responsibilities separate', () => {
    expect(analyticsEventCatalog.page_viewed.owner).toBe('posthog');
    expect(analyticsEventCatalog.team_created.owner).toBe('posthog');
    expect(analyticsEventCatalog.api_request_completed.owner).toBe('otel');
    expect(analyticsEventCatalog.ui_error_captured.owner).toBe('otel');
  });
});
