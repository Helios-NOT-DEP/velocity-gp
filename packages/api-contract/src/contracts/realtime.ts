import { z } from 'zod';
import type { UpdateRaceControlResponse } from './adminControls.js';
import type { LeaderboardEntry, RescueStatus } from './participants.js';
import type { HazardPitScanResult, SafeScanResult } from './scans.js';

export const raceRealtimeEventTypes = [
  'SCAN_SUCCESS',
  'HAZARD_HIT',
  'PIT_RELEASED',
  'RESCUE_UPDATED',
  'RACE_CONTROL_UPDATED',
  'LEADERBOARD_CHANGED',
] as const;

export type RaceRealtimeEventType = (typeof raceRealtimeEventTypes)[number];

export const raceRealtimeChannels = ['player', 'admin', 'display', 'automation'] as const;

export type RaceRealtimeChannel = (typeof raceRealtimeChannels)[number];

export const EVENT_SCOPED_STREAM_KEY_TEMPLATE = 'event:{eventId}' as const;
export const TEAM_SCOPED_STREAM_KEY_TEMPLATE = 'event:{eventId}:team:{teamId}' as const;

export const raceRealtimeStreamKeyPattern = /^event:[^:]+(?::team:[^:]+)?$/;

export const pitReleaseReasons = ['TIMER_EXPIRED', 'RESCUE_CLEARED', 'ADMIN_MANUAL'] as const;

export type PitReleaseReason = (typeof pitReleaseReasons)[number];

export const leaderboardChangeTriggers = [
  'SCAN_SETTLED',
  'PIT_RELEASED',
  'RESCUE_COMPLETED',
  'RACE_CONTROL_UPDATED',
  'ADMIN_ADJUSTMENT',
  'SCORE_RESET',
] as const;

export type LeaderboardChangeTrigger = (typeof leaderboardChangeTriggers)[number];

export interface ScanSuccessEventPayload {
  readonly scan: SafeScanResult;
}

export interface HazardHitEventPayload {
  readonly scan: HazardPitScanResult;
}

export interface PitReleasedEventPayload {
  readonly teamId: string;
  readonly status: 'ACTIVE';
  readonly pitStopExpiresAt: null;
  readonly releasedAt: string;
  readonly reason: PitReleaseReason;
}

export interface RescueUpdatedEventPayload {
  readonly rescueId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly rescuerUserId: string;
  readonly status: RescueStatus;
  readonly initiatedAt: string;
  readonly completedAt: string | null;
  readonly reason?: string | null;
}

export interface RaceControlUpdatedEventPayload {
  readonly update: UpdateRaceControlResponse;
}

export interface LeaderboardChangedEventPayload {
  readonly leaderboard: LeaderboardEntry[];
  readonly changedAt: string;
  readonly trigger: LeaderboardChangeTrigger;
}

export interface RaceRealtimeEventPayloadMap {
  readonly SCAN_SUCCESS: ScanSuccessEventPayload;
  readonly HAZARD_HIT: HazardHitEventPayload;
  readonly PIT_RELEASED: PitReleasedEventPayload;
  readonly RESCUE_UPDATED: RescueUpdatedEventPayload;
  readonly RACE_CONTROL_UPDATED: RaceControlUpdatedEventPayload;
  readonly LEADERBOARD_CHANGED: LeaderboardChangedEventPayload;
}

export interface RaceRealtimeEventEnvelope<
  TPayload = unknown,
  TType extends RaceRealtimeEventType = RaceRealtimeEventType,
> {
  readonly id: string;
  readonly type: TType;
  readonly version: 1;
  readonly occurredAt: string;
  readonly eventId: string;
  readonly streamKey: string;
  readonly streamSequence: number;
  readonly idempotencyKey: string;
  readonly payload: TPayload;
}

export type RaceRealtimeEvent<TType extends RaceRealtimeEventType = RaceRealtimeEventType> =
  RaceRealtimeEventEnvelope<RaceRealtimeEventPayloadMap[TType], TType>;

export type RaceRealtimeEventUnion = {
  [TType in RaceRealtimeEventType]: RaceRealtimeEvent<TType>;
}[RaceRealtimeEventType];

export interface CreateRaceRealtimeEventEnvelopeInput<TType extends RaceRealtimeEventType> {
  readonly id: string;
  readonly type: TType;
  readonly version?: 1;
  readonly occurredAt: string;
  readonly eventId: string;
  readonly streamKey: string;
  readonly streamSequence: number;
  readonly idempotencyKey?: string;
  readonly payload: RaceRealtimeEventPayloadMap[TType];
}

export function createRaceRealtimeEventEnvelope<TType extends RaceRealtimeEventType>(
  input: CreateRaceRealtimeEventEnvelopeInput<TType>
): RaceRealtimeEvent<TType> {
  return {
    id: input.id,
    type: input.type,
    version: input.version ?? 1,
    occurredAt: input.occurredAt,
    eventId: input.eventId,
    streamKey: input.streamKey,
    streamSequence: input.streamSequence,
    idempotencyKey: input.idempotencyKey ?? input.id,
    payload: input.payload,
  };
}

export function buildEventStreamKey(eventId: string): string {
  return `event:${eventId}`;
}

export function buildTeamStreamKey(eventId: string, teamId: string): string {
  return `event:${eventId}:team:${teamId}`;
}

export function isRaceRealtimeStreamKey(streamKey: string): boolean {
  return raceRealtimeStreamKeyPattern.test(streamKey);
}

export const raceRealtimeChannelPolicy = {
  player: ['SCAN_SUCCESS', 'HAZARD_HIT', 'PIT_RELEASED', 'RESCUE_UPDATED', 'RACE_CONTROL_UPDATED'],
  admin: raceRealtimeEventTypes,
  display: ['LEADERBOARD_CHANGED', 'HAZARD_HIT', 'PIT_RELEASED', 'RESCUE_UPDATED'],
  automation: raceRealtimeEventTypes,
} as const satisfies Record<RaceRealtimeChannel, readonly RaceRealtimeEventType[]>;

export type AllowedRaceRealtimeEventType<TChannel extends RaceRealtimeChannel> =
  (typeof raceRealtimeChannelPolicy)[TChannel][number];

export interface RaceRealtimeSubscription<
  TChannel extends RaceRealtimeChannel = RaceRealtimeChannel,
> {
  readonly channel: TChannel;
  readonly eventTypes: readonly AllowedRaceRealtimeEventType<TChannel>[];
}

export function isRaceRealtimeEventTypeAllowedForChannel(
  channel: RaceRealtimeChannel,
  eventType: RaceRealtimeEventType
): boolean {
  return (raceRealtimeChannelPolicy[channel] as readonly RaceRealtimeEventType[]).includes(
    eventType
  );
}

const scanResultBaseSchema = z.object({
  outcome: z.enum(['SAFE', 'HAZARD_PIT', 'INVALID', 'DUPLICATE', 'BLOCKED']),
  eventId: z.string().min(1),
  playerId: z.string().min(1),
  teamId: z.string().min(1).nullable(),
  qrCodeId: z.string().min(1).nullable(),
  qrPayload: z.string().min(1),
  scannedAt: z.string().datetime(),
  message: z.string().min(1),
});

const safeScanResultSchema = scanResultBaseSchema.extend({
  outcome: z.literal('SAFE'),
  pointsAwarded: z.number().int(),
  teamScore: z.number().int(),
  claimCreated: z.literal(true),
  hazardRatioUsed: z.number().int().positive(),
});

const hazardPitScanResultSchema = scanResultBaseSchema.extend({
  outcome: z.literal('HAZARD_PIT'),
  pointsAwarded: z.literal(0),
  teamScore: z.number().int(),
  pitStopExpiresAt: z.string().datetime(),
  hazardRatioUsed: z.number().int().positive(),
});

const rescueStatusSchema = z.enum(['REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']);
const teamStatusSchema = z.enum(['PENDING', 'ACTIVE', 'IN_PIT']);
const raceControlStateSchema = z.enum(['ACTIVE', 'PAUSED']);
const pitReleaseReasonSchema = z.enum(pitReleaseReasons);
const leaderboardChangeTriggerSchema = z.enum(leaderboardChangeTriggers);

export const raceRealtimeEventTypeSchema = z.enum(raceRealtimeEventTypes);

export const scanSuccessEventPayloadSchema = z.object({
  scan: safeScanResultSchema,
});

export const hazardHitEventPayloadSchema = z.object({
  scan: hazardPitScanResultSchema,
});

export const pitReleasedEventPayloadSchema = z.object({
  teamId: z.string().min(1),
  status: z.literal('ACTIVE'),
  pitStopExpiresAt: z.null(),
  releasedAt: z.string().datetime(),
  reason: pitReleaseReasonSchema,
});

export const rescueUpdatedEventPayloadSchema = z.object({
  rescueId: z.string().min(1),
  playerId: z.string().min(1),
  teamId: z.string().min(1),
  rescuerUserId: z.string().min(1),
  status: rescueStatusSchema,
  initiatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  reason: z.string().min(1).nullable().optional(),
});

export const raceControlUpdatedEventPayloadSchema = z.object({
  update: z.object({
    eventId: z.string().min(1),
    state: raceControlStateSchema,
    updatedAt: z.string().datetime(),
    auditId: z.string().min(1),
  }),
});

export const leaderboardChangedEventPayloadSchema = z.object({
  leaderboard: z.array(
    z.object({
      rank: z.number().int().positive(),
      teamId: z.string().min(1),
      teamName: z.string().min(1),
      score: z.number().int(),
      memberCount: z.number().int().nonnegative(),
      status: teamStatusSchema,
    })
  ),
  changedAt: z.string().datetime(),
  trigger: leaderboardChangeTriggerSchema,
});

export const raceRealtimePayloadSchemaByType = {
  SCAN_SUCCESS: scanSuccessEventPayloadSchema,
  HAZARD_HIT: hazardHitEventPayloadSchema,
  PIT_RELEASED: pitReleasedEventPayloadSchema,
  RESCUE_UPDATED: rescueUpdatedEventPayloadSchema,
  RACE_CONTROL_UPDATED: raceControlUpdatedEventPayloadSchema,
  LEADERBOARD_CHANGED: leaderboardChangedEventPayloadSchema,
} as const;

export const raceRealtimeEventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: raceRealtimeEventTypeSchema,
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  eventId: z.string().min(1),
  streamKey: z
    .string()
    .min(1)
    .refine((value) => isRaceRealtimeStreamKey(value), {
      message: `streamKey must match ${EVENT_SCOPED_STREAM_KEY_TEMPLATE} or ${TEAM_SCOPED_STREAM_KEY_TEMPLATE}`,
    }),
  streamSequence: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
  payload: z.unknown(),
});

export const raceRealtimeEventSchema = raceRealtimeEventEnvelopeSchema.superRefine((value, ctx) => {
  const payloadSchema = raceRealtimePayloadSchemaByType[value.type];
  const payloadParseResult = payloadSchema.safeParse(value.payload);

  if (payloadParseResult.success) {
    return;
  }

  payloadParseResult.error.issues.forEach((issue) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['payload', ...issue.path],
      message: issue.message,
    });
  });
});

export const raceRealtimeChannelSchema = z.enum(raceRealtimeChannels);

export const raceRealtimeSubscriptionSchema = z
  .object({
    channel: raceRealtimeChannelSchema,
    eventTypes: z.array(raceRealtimeEventTypeSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const allowedEventTypes = new Set<RaceRealtimeEventType>(
      raceRealtimeChannelPolicy[value.channel]
    );
    value.eventTypes.forEach((eventType, index) => {
      if (allowedEventTypes.has(eventType)) {
        return;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventTypes', index],
        message: `Event type ${eventType} is not allowed for channel ${value.channel}.`,
      });
    });
  });

export type RaceRealtimeEventEnvelopeParsed = z.infer<typeof raceRealtimeEventEnvelopeSchema>;
export type RaceRealtimeEventParsed = z.infer<typeof raceRealtimeEventSchema>;
export type RaceRealtimeSubscriptionParsed = z.infer<typeof raceRealtimeSubscriptionSchema>;
