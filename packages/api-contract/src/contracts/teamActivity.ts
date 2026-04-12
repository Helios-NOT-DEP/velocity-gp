/**
 * @file teamActivity.ts
 * @description Contracts for team-scoped running activity feeds shown in Race Hub.
 */

import type { ScanOutcome, StableErrorCode } from './scans.js';

export const teamActivityEventTypes = ['PLAYER_ONBOARDING_COMPLETED', 'PLAYER_QR_SCAN'] as const;

export type TeamActivityEventType = (typeof teamActivityEventTypes)[number];

interface TeamActivityFeedItemBase {
  readonly id: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly type: TeamActivityEventType;
  readonly occurredAt: string;
}

export interface PlayerOnboardingCompletedActivityItem extends TeamActivityFeedItemBase {
  readonly type: 'PLAYER_ONBOARDING_COMPLETED';
  readonly summary: string;
}

export interface PlayerQrScanActivityItem extends TeamActivityFeedItemBase {
  readonly type: 'PLAYER_QR_SCAN';
  readonly qrCodeId: string | null;
  readonly qrCodeLabel: string | null;
  readonly qrPayload: string;
  readonly scanOutcome: ScanOutcome;
  readonly pointsAwarded: number;
  readonly errorCode: StableErrorCode | null;
  readonly summary: string;
}

export type TeamActivityFeedItem = PlayerOnboardingCompletedActivityItem | PlayerQrScanActivityItem;

export interface ListTeamActivityFeedQuery {
  readonly limit?: number;
}

export interface ListTeamActivityFeedResponse {
  readonly items: readonly TeamActivityFeedItem[];
}
