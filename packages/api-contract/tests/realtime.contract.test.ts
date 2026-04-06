import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildEventStreamKey,
  buildTeamStreamKey,
  createRaceRealtimeEventEnvelope,
  isRaceRealtimeStreamKey,
  raceRealtimeChannelPolicy,
  raceRealtimeEventSchema,
  raceRealtimeEventTypes,
  raceRealtimeSubscriptionSchema,
  type RaceRealtimeEvent,
  type RaceRealtimeEventUnion,
  type RaceRealtimeEventType,
} from '../src/contracts/realtime.js';

function createSafeScanEvent(): RaceRealtimeEvent<'SCAN_SUCCESS'> {
  return createRaceRealtimeEventEnvelope({
    id: 'evt-safe-1',
    type: 'SCAN_SUCCESS',
    occurredAt: '2026-04-06T00:00:00.000Z',
    eventId: 'event-1',
    streamKey: buildTeamStreamKey('event-1', 'team-a'),
    streamSequence: 1,
    payload: {
      scan: {
        outcome: 'SAFE',
        eventId: 'event-1',
        playerId: 'player-1',
        teamId: 'team-a',
        qrCodeId: 'qr-1',
        qrPayload: 'QR-1',
        scannedAt: '2026-04-06T00:00:00.000Z',
        message: 'Fuel gained.',
        pointsAwarded: 100,
        teamScore: 300,
        claimCreated: true,
        hazardRatioUsed: 15,
      },
    },
  });
}

function createHazardHitEvent(): RaceRealtimeEvent<'HAZARD_HIT'> {
  return createRaceRealtimeEventEnvelope({
    id: 'evt-hazard-1',
    type: 'HAZARD_HIT',
    occurredAt: '2026-04-06T00:00:01.000Z',
    eventId: 'event-1',
    streamKey: buildTeamStreamKey('event-1', 'team-a'),
    streamSequence: 2,
    payload: {
      scan: {
        outcome: 'HAZARD_PIT',
        eventId: 'event-1',
        playerId: 'player-1',
        teamId: 'team-a',
        qrCodeId: 'qr-1',
        qrPayload: 'QR-1',
        scannedAt: '2026-04-06T00:00:01.000Z',
        message: 'Hazard triggered.',
        pointsAwarded: 0,
        teamScore: 300,
        pitStopExpiresAt: '2026-04-06T00:15:01.000Z',
        hazardRatioUsed: 15,
      },
    },
  });
}

function createPitReleasedEvent(): RaceRealtimeEvent<'PIT_RELEASED'> {
  return createRaceRealtimeEventEnvelope({
    id: 'evt-pit-1',
    type: 'PIT_RELEASED',
    occurredAt: '2026-04-06T00:16:00.000Z',
    eventId: 'event-1',
    streamKey: buildTeamStreamKey('event-1', 'team-a'),
    streamSequence: 3,
    payload: {
      teamId: 'team-a',
      status: 'ACTIVE',
      pitStopExpiresAt: null,
      releasedAt: '2026-04-06T00:16:00.000Z',
      reason: 'TIMER_EXPIRED',
    },
  });
}

function createRescueUpdatedEvent(): RaceRealtimeEvent<'RESCUE_UPDATED'> {
  return createRaceRealtimeEventEnvelope({
    id: 'evt-rescue-1',
    type: 'RESCUE_UPDATED',
    occurredAt: '2026-04-06T00:10:00.000Z',
    eventId: 'event-1',
    streamKey: buildTeamStreamKey('event-1', 'team-a'),
    streamSequence: 4,
    payload: {
      rescueId: 'rescue-1',
      playerId: 'player-1',
      teamId: 'team-a',
      rescuerUserId: 'user-helios-2',
      status: 'COMPLETED',
      initiatedAt: '2026-04-06T00:08:00.000Z',
      completedAt: '2026-04-06T00:10:00.000Z',
      reason: null,
    },
  });
}

function createRaceControlUpdatedEvent(): RaceRealtimeEvent<'RACE_CONTROL_UPDATED'> {
  return createRaceRealtimeEventEnvelope({
    id: 'evt-race-control-1',
    type: 'RACE_CONTROL_UPDATED',
    occurredAt: '2026-04-06T00:20:00.000Z',
    eventId: 'event-1',
    streamKey: buildEventStreamKey('event-1'),
    streamSequence: 1,
    payload: {
      update: {
        eventId: 'event-1',
        state: 'PAUSED',
        updatedAt: '2026-04-06T00:20:00.000Z',
        auditId: 'audit-1',
      },
    },
  });
}

function createLeaderboardChangedEvent(): RaceRealtimeEvent<'LEADERBOARD_CHANGED'> {
  return createRaceRealtimeEventEnvelope({
    id: 'evt-board-1',
    type: 'LEADERBOARD_CHANGED',
    occurredAt: '2026-04-06T00:21:00.000Z',
    eventId: 'event-1',
    streamKey: buildEventStreamKey('event-1'),
    streamSequence: 2,
    payload: {
      leaderboard: [
        {
          rank: 1,
          teamId: 'team-a',
          teamName: 'Team A',
          score: 400,
          memberCount: 4,
          status: 'ACTIVE',
        },
      ],
      changedAt: '2026-04-06T00:21:00.000Z',
      trigger: 'SCAN_SETTLED',
    },
  });
}

describe('realtime contract', () => {
  it('creates envelopes with idempotencyKey defaulting to id', () => {
    const event = createSafeScanEvent();
    expect(event.idempotencyKey).toBe(event.id);

    expectTypeOf(event.type).toEqualTypeOf<'SCAN_SUCCESS'>();
    expectTypeOf(event.payload.scan.outcome).toEqualTypeOf<'SAFE'>();
  });

  it('supports event-union narrowing by type', () => {
    const event: RaceRealtimeEventUnion = createHazardHitEvent();

    if (event.type === 'HAZARD_HIT') {
      expect(event.payload.scan.outcome).toBe('HAZARD_PIT');
      expectTypeOf(event.payload.scan.outcome).toEqualTypeOf<'HAZARD_PIT'>();
      return;
    }

    throw new Error('Expected HAZARD_HIT event in narrowing test.');
  });

  it('enforces channel policy and rejects disallowed event types', () => {
    expect(raceRealtimeChannelPolicy.admin).toEqual(raceRealtimeEventTypes);
    expect(raceRealtimeChannelPolicy.automation).toEqual(raceRealtimeEventTypes);

    const valid = raceRealtimeSubscriptionSchema.safeParse({
      channel: 'display',
      eventTypes: ['LEADERBOARD_CHANGED', 'PIT_RELEASED'],
    });
    expect(valid.success).toBe(true);

    const invalid = raceRealtimeSubscriptionSchema.safeParse({
      channel: 'player',
      eventTypes: ['LEADERBOARD_CHANGED'],
    });
    expect(invalid.success).toBe(false);
  });

  it('validates canonical fixtures for every event type', () => {
    const fixtures: Record<RaceRealtimeEventType, RaceRealtimeEvent> = {
      SCAN_SUCCESS: createSafeScanEvent(),
      HAZARD_HIT: createHazardHitEvent(),
      PIT_RELEASED: createPitReleasedEvent(),
      RESCUE_UPDATED: createRescueUpdatedEvent(),
      RACE_CONTROL_UPDATED: createRaceControlUpdatedEvent(),
      LEADERBOARD_CHANGED: createLeaderboardChangedEvent(),
    };

    for (const [eventType, eventFixture] of Object.entries(fixtures)) {
      const parsed = raceRealtimeEventSchema.safeParse(eventFixture);
      expect(parsed.success, `${eventType} fixture should parse`).toBe(true);
    }
  });

  it('rejects invalid envelope shape values', () => {
    const invalidVersion = raceRealtimeEventSchema.safeParse({
      ...createSafeScanEvent(),
      version: 2,
    });
    expect(invalidVersion.success).toBe(false);

    const invalidSequence = raceRealtimeEventSchema.safeParse({
      ...createSafeScanEvent(),
      streamSequence: 0,
    });
    expect(invalidSequence.success).toBe(false);

    const invalidType = raceRealtimeEventSchema.safeParse({
      ...createSafeScanEvent(),
      type: 'UNKNOWN_EVENT',
    });
    expect(invalidType.success).toBe(false);
  });

  it('builds and validates default stream-key patterns', () => {
    expect(buildEventStreamKey('event-99')).toBe('event:event-99');
    expect(buildTeamStreamKey('event-99', 'team-7')).toBe('event:event-99:team:team-7');

    expect(isRaceRealtimeStreamKey('event:event-99')).toBe(true);
    expect(isRaceRealtimeStreamKey('event:event-99:team:team-7')).toBe(true);
    expect(isRaceRealtimeStreamKey('event:event-99:team')).toBe(false);
    expect(isRaceRealtimeStreamKey('not-a-stream-key')).toBe(false);
  });
});
