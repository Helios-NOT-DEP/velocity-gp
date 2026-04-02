import type { EventSummary, Hazard, PlayerProfile, Team } from '../contracts/domain.js';

const baseTimestamp = new Date('2026-04-01T12:00:00.000Z');

export function createIsoDate(offsetMinutes: number = 0): string {
  return new Date(baseTimestamp.getTime() + offsetMinutes * 60_000).toISOString();
}

export const placeholderEvent: EventSummary = {
  id: 'event-123',
  name: 'Velocity GP Spring Qualifier',
  startDate: createIsoDate(-180),
  endDate: createIsoDate(360),
  status: 'ACTIVE',
};

export const placeholderPlayer: PlayerProfile = {
  id: 'player-123',
  email: 'driver@velocitygp.dev',
  name: 'Avery Apex',
  eventId: placeholderEvent.id,
  createdAt: createIsoDate(-240),
};

export const placeholderTeam: Team = {
  id: 'team-123',
  name: 'Helios Hyperdrive',
  eventId: placeholderEvent.id,
  members: [placeholderPlayer.id, 'player-456', 'player-789'],
  score: 1280,
};

export const placeholderHazards: Hazard[] = [
  {
    id: 'hazard-001',
    name: 'Battery Drop',
    ratio: 1.5,
    description: 'Simulated battery loss that sends racers toward the pit lane.',
    eventId: placeholderEvent.id,
  },
  {
    id: 'hazard-002',
    name: 'Telemetry Glitch',
    ratio: 2.25,
    description: 'A scoring glitch that needs a quick Helios intervention.',
    eventId: placeholderEvent.id,
  },
];
