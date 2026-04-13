/**
 * @file realtime.ts
 * @description Serves as the definitive blueprint for Realtime WebSocket (or equivalent push) Events.
 * Standardizes the "Envelope" shape and internal payloads moving rapidly from the Event Bus
 * directly into the frontend clients preventing visual latency. Integrates heavy Zod validation
 * immediately checking incoming pushes ensuring data integrity safely bypasses Rest APIs.
 */

import { z } from 'zod';
import type { UpdateRaceControlResponse } from './adminControls.js';
import type { LeaderboardEntry, RescueStatus } from './participants.js';
import type { HazardPitScanResult, SafeScanResult } from './scans.js';

/** Array containing the exclusive list of supported realtime push events fired by the simulation. */
export const raceRealtimeEventTypes = [
  'SCAN_SUCCESS',
  'HAZARD_HIT',
  'PIT_RELEASED',
  'RESCUE_UPDATED',
  'RACE_CONTROL_UPDATED',
  'LEADERBOARD_CHANGED',
] as const;

/** Union typing capturing the valid realtime system signals. */
export type RaceRealtimeEventType = (typeof raceRealtimeEventTypes)[number];

/** Broad subscription categories assigning differing access topologies based on player apps vs admin panels. */
export const raceRealtimeChannels = ['player', 'admin', 'display', 'automation'] as const;

/** Permitted channel strings denoting who should hear which broadcast. */
export type RaceRealtimeChannel = (typeof raceRealtimeChannels)[number];

/** Formatting template constraining Redis/SSE Event-scoped stream paths. */
export const EVENT_SCOPED_STREAM_KEY_TEMPLATE = 'event:{eventId}' as const;

/** Formatting template constraining Redis/SSE Team-scoped (private) stream paths. */
export const TEAM_SCOPED_STREAM_KEY_TEMPLATE = 'event:{eventId}:team:{teamId}' as const;

/** RegExp strictly parsing the dynamic keys routing realtime signals globally or natively. */
export const raceRealtimeStreamKeyPattern = /^event:[^:]+(?::team:[^:]+)?$/;

/** Distinct business reasons indicating precisely *why* a team left an enforced PIT state. */
export const pitReleaseReasons = ['TIMER_EXPIRED', 'RESCUE_CLEARED', 'ADMIN_MANUAL'] as const;

/** Union describing the cause behind removing an active Team penalty. */
export type PitReleaseReason = (typeof pitReleaseReasons)[number];

/** Core system hooks dynamically mutating score aggregations on the display matrix. */
export const leaderboardChangeTriggers = [
  'SCAN_SETTLED',
  'PIT_RELEASED',
  'RESCUE_COMPLETED',
  'RACE_CONTROL_UPDATED',
  'ADMIN_ADJUSTMENT',
  'SCORE_RESET',
] as const;

/** Event identifier explaining why the leaderboard is triggering a re-render. */
export type LeaderboardChangeTrigger = (typeof leaderboardChangeTriggers)[number];

/** Push payload mirroring the completion of a non-penalizing Scan outcome. */
export interface ScanSuccessEventPayload {
  readonly scan: SafeScanResult;
}

/** Push payload broadcasting that a scanning action directly caused a PIT penalty. */
export interface HazardHitEventPayload {
  readonly scan: HazardPitScanResult;
}

/** Push payload indicating a trapped Team is once again freely allowed to scan objects and race. */
export interface PitReleasedEventPayload {
  readonly teamId: string;
  readonly status: 'ACTIVE';
  readonly pitStopExpiresAt: null;
  readonly releasedAt: string;
  readonly reason: PitReleaseReason;
}

/** Push payload syncing a change within the cooperative Helper/Rescue mechanics. */
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

/** Push payload communicating top-level structural overrides from Administrators (e.g. pausing the game). */
export interface RaceControlUpdatedEventPayload {
  readonly update: UpdateRaceControlResponse;
}

/** Push payload delivering compiled team points hierarchies for massive public display boards natively. */
export interface LeaderboardChangedEventPayload {
  readonly leaderboard: LeaderboardEntry[];
  readonly changedAt: string;
  readonly trigger: LeaderboardChangeTrigger;
}

/** Type Map assigning stringent inner payload data shapes bounded to their EventType literal keys. */
export interface RaceRealtimeEventPayloadMap {
  readonly SCAN_SUCCESS: ScanSuccessEventPayload;
  readonly HAZARD_HIT: HazardHitEventPayload;
  readonly PIT_RELEASED: PitReleasedEventPayload;
  readonly RESCUE_UPDATED: RescueUpdatedEventPayload;
  readonly RACE_CONTROL_UPDATED: RaceControlUpdatedEventPayload;
  readonly LEADERBOARD_CHANGED: LeaderboardChangedEventPayload;
}

/**
 * Wraps dynamic internal payloads behind a strict exterior envelope. Ensures consistency
 * enforcing message streams, idempotency IDs, and delivery sequence mapping.
 */
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

/** Explicit intersection yielding an Envelope tightly coupled to its mapped Payload constraint. */
export type RaceRealtimeEvent<TType extends RaceRealtimeEventType = RaceRealtimeEventType> =
  RaceRealtimeEventEnvelope<RaceRealtimeEventPayloadMap[TType], TType>;

/** Total union mapping spanning every permutation of internal and external WebSocket broadcast. */
export type RaceRealtimeEventUnion = {
  [TType in RaceRealtimeEventType]: RaceRealtimeEvent<TType>;
}[RaceRealtimeEventType];

/** Stripped down request used by publishing microservices trying to spawn a new dispatch. */
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

/**
 * Functional factory safely bootstrapping raw realtime signals into fully compliant
 * Event Envelopes conforming exactly to the validation structure.
 */
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

/** Constructor utility assembling strict Redis topic strings for Event-level broadcasts. */
export function buildEventStreamKey(eventId: string): string {
  return `event:${eventId}`;
}

/** Constructor utility assembling string topics reserved strictly for an isolated Team's viewership. */
export function buildTeamStreamKey(eventId: string, teamId: string): string {
  return `event:${eventId}:team:${teamId}`;
}

/** Validator function validating external topic names utilizing expected RegExp heuristics. */
export function isRaceRealtimeStreamKey(streamKey: string): boolean {
  return raceRealtimeStreamKeyPattern.test(streamKey);
}

/**
 * Access-Control bindings linking what class of observer (Admin vs Player)
 * receives specific telemetry vectors. Filters noisy updates.
 */
export const raceRealtimeChannelPolicy = {
  player: ['SCAN_SUCCESS', 'HAZARD_HIT', 'PIT_RELEASED', 'RESCUE_UPDATED', 'RACE_CONTROL_UPDATED'],
  admin: raceRealtimeEventTypes,
  display: ['LEADERBOARD_CHANGED', 'HAZARD_HIT', 'PIT_RELEASED', 'RESCUE_UPDATED'],
  automation: raceRealtimeEventTypes,
} as const satisfies Record<RaceRealtimeChannel, readonly RaceRealtimeEventType[]>;

/** Extracts precisely the accepted realtime events permissible to a designated channel. */
export type AllowedRaceRealtimeEventType<TChannel extends RaceRealtimeChannel> =
  (typeof raceRealtimeChannelPolicy)[TChannel][number];

/** Payload configuring what data is routed towards a persistent frontend client link. */
export interface RaceRealtimeSubscription<
  TChannel extends RaceRealtimeChannel = RaceRealtimeChannel,
> {
  readonly channel: TChannel;
  readonly eventTypes: readonly AllowedRaceRealtimeEventType<TChannel>[];
}

/** Functional check strictly asserting that an attempted subscription abides by system security boundaries. */
export function isRaceRealtimeEventTypeAllowedForChannel(
  channel: RaceRealtimeChannel,
  eventType: RaceRealtimeEventType
): boolean {
  return (raceRealtimeChannelPolicy[channel] as readonly RaceRealtimeEventType[]).includes(
    eventType
  );
}

// --------------------------------------------------------------------------------------------
// ZOD SCHEMAS: Defensive compilation schemas checking network data upon landing on the frontend
// --------------------------------------------------------------------------------------------

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

/** Exported native Zod Schema limiting parsing directly to allowed event unions. */
export const raceRealtimeEventTypeSchema = z.enum(raceRealtimeEventTypes);

/** Runtime schema boundary defining internal data shapes upon SCAN_SUCCESS. */
export const scanSuccessEventPayloadSchema = z.object({
  scan: safeScanResultSchema,
});

/** Runtime schema boundary defining internal data shapes upon HAZARD_HIT. */
export const hazardHitEventPayloadSchema = z.object({
  scan: hazardPitScanResultSchema,
});

/** Runtime schema boundary defining internal data shapes upon PIT_RELEASED. */
export const pitReleasedEventPayloadSchema = z.object({
  teamId: z.string().min(1),
  status: z.literal('ACTIVE'),
  pitStopExpiresAt: z.null(),
  releasedAt: z.string().datetime(),
  reason: pitReleaseReasonSchema,
});

/** Runtime schema boundary defining internal data shapes upon RESCUE_UPDATED. */
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

/** Runtime schema boundary defining internal data shapes upon RACE_CONTROL_UPDATED. */
export const raceControlUpdatedEventPayloadSchema = z.object({
  update: z.object({
    eventId: z.string().min(1),
    state: raceControlStateSchema,
    updatedAt: z.string().datetime(),
    auditId: z.string().min(1),
  }),
});

/** Runtime schema boundary defining internal data shapes upon LEADERBOARD_CHANGED. */
export const leaderboardChangedEventPayloadSchema = z.object({
  leaderboard: z.array(
    z.object({
      rank: z.number().int().positive(),
      teamId: z.string().min(1),
      teamName: z.string().min(1),
      score: z.number().int(),
      memberCount: z.number().int().nonnegative(),
      status: teamStatusSchema,
      pitStopExpiresAt: z.string().datetime().nullable().optional(),
    })
  ),
  changedAt: z.string().datetime(),
  trigger: leaderboardChangeTriggerSchema,
});

/** Mapped index aligning schema structures to their designated Type Identifiers universally. */
export const raceRealtimePayloadSchemaByType = {
  SCAN_SUCCESS: scanSuccessEventPayloadSchema,
  HAZARD_HIT: hazardHitEventPayloadSchema,
  PIT_RELEASED: pitReleasedEventPayloadSchema,
  RESCUE_UPDATED: rescueUpdatedEventPayloadSchema,
  RACE_CONTROL_UPDATED: raceControlUpdatedEventPayloadSchema,
  LEADERBOARD_CHANGED: leaderboardChangedEventPayloadSchema,
} as const;

/** Zod evaluator inspecting solely the upper-level Envelope dimensions before descending lower. */
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

/** Fully synthesized structural Schema validator processing massive events globally. */
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

/** Evaluator ensuring only properly classified network Channel types are observed. */
export const raceRealtimeChannelSchema = z.enum(raceRealtimeChannels);

/** Subscription schema blocking malicious access to cross-boundary event telemetry paths. */
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

/** Statically parsed wrapper definitions exposing native TypeScript traits dynamically built from Zod. */
export type RaceRealtimeEventEnvelopeParsed = z.infer<typeof raceRealtimeEventEnvelopeSchema>;
export type RaceRealtimeEventParsed = z.infer<typeof raceRealtimeEventSchema>;
export type RaceRealtimeSubscriptionParsed = z.infer<typeof raceRealtimeSubscriptionSchema>;
