import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Publisher abstractions for team pit-release events.
 *
 * The default implementation is environment-driven: webhook when configured,
 * noop otherwise.
 */
export type PitReleaseReason = 'TIMER_EXPIRED' | 'RESCUE_CLEARED' | 'ADMIN_MANUAL';

export interface TeamPitReleasedEvent {
  readonly eventId: string;
  readonly teamId: string;
  readonly status: 'ACTIVE';
  readonly pitStopExpiresAt: null;
  readonly releasedAt: string;
  readonly reason: PitReleaseReason;
}

export interface PitReleasePublisher {
  publishTeamReleased(event: TeamPitReleasedEvent): Promise<void>;
}

/**
 * No-op publisher used in local/dev setups without a webhook.
 */
class NoopPitReleasePublisher implements PitReleasePublisher {
  async publishTeamReleased(event: TeamPitReleasedEvent): Promise<void> {
    logger.debug('pit release publish skipped (no publisher configured)', { event });
  }
}

/**
 * Webhook-backed publisher for external pit-release consumers.
 */
class WebhookPitReleasePublisher implements PitReleasePublisher {
  readonly #url: string;
  readonly #timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    this.#url = url;
    this.#timeoutMs = timeoutMs;
  }

  async publishTeamReleased(event: TeamPitReleasedEvent): Promise<void> {
    const abortController = new globalThis.AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.#timeoutMs);

    try {
      const response = await fetch(this.#url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-velocity-event': 'TEAM_PIT_RELEASED',
        },
        body: JSON.stringify(event),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook publish failed with status ${response.status}`);
      }
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}

let publisherOverride: PitReleasePublisher | null = null;

function createDefaultPublisher(): PitReleasePublisher {
  if (!env.PIT_RELEASE_WEBHOOK_URL) {
    return new NoopPitReleasePublisher();
  }

  return new WebhookPitReleasePublisher(
    env.PIT_RELEASE_WEBHOOK_URL,
    env.PIT_RELEASE_WEBHOOK_TIMEOUT_MS
  );
}

const defaultPublisher = createDefaultPublisher();

/**
 * Returns the active pit-release publisher implementation.
 */
export function getPitReleasePublisher(): PitReleasePublisher {
  return publisherOverride ?? defaultPublisher;
}

/**
 * Test-only hook to override publisher behavior.
 */
export function setPitReleasePublisherForTests(publisher: PitReleasePublisher | null): void {
  publisherOverride = publisher;
}
