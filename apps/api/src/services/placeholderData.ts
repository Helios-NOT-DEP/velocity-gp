import type {
  AdminAuditEntry,
  EventSummary,
  HeliosRescueFlow,
  PlayerProfile,
  QRCodeSummary,
  Team,
  TeamStatus,
} from '@velocity-gp/api-contract';

/**
 * Shared placeholder fixture data used by service modules that are not yet fully
 * wired to persisted storage.
 */
const baseTimestamp = new Date('2026-04-06T12:00:00.000Z');

/**
 * Produces deterministic ISO timestamps relative to the shared base fixture time.
 */
export function createIsoDate(offsetMinutes: number = 0): string {
  return new Date(baseTimestamp.getTime() + offsetMinutes * 60_000).toISOString();
}

export const placeholderEvent: EventSummary = {
  id: 'event-velocity-active',
  name: 'Velocity GP Spring Finals',
  startDate: createIsoDate(-180),
  endDate: createIsoDate(360),
  status: 'ACTIVE',
};

export const placeholderPlayer: PlayerProfile = {
  id: 'player-lina-active',
  userId: 'user-player-lina',
  email: 'lina@velocitygp.dev',
  name: 'Lina Lane',
  eventId: placeholderEvent.id,
  teamId: 'team-apex-comets',
  status: 'RACING',
  individualScore: 430,
  isFlaggedForReview: false,
  joinedAt: createIsoDate(-240),
  createdAt: createIsoDate(-240),
};

export const placeholderTeam: Team = {
  id: 'team-apex-comets',
  name: 'Apex Comets',
  eventId: placeholderEvent.id,
  status: 'ACTIVE',
  pitStopExpiresAt: null,
  members: [placeholderPlayer.id, 'player-mason-active'],
  score: 1260,
};

export const placeholderQRCodes: QRCodeSummary[] = [
  {
    id: 'qr-alpha-01',
    eventId: placeholderEvent.id,
    label: 'Atrium Checkpoint Alpha',
    value: 100,
    zone: 'Atrium',
    payload: 'VG-ALPHA-01',
    status: 'ACTIVE',
    scanCount: 14,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
    activationStartsAt: createIsoDate(-180),
    activationEndsAt: null,
  },
  {
    id: 'qr-beta-02',
    eventId: placeholderEvent.id,
    label: 'Rooftop Beta Boost',
    value: 120,
    zone: 'Rooftop',
    payload: 'VG-BETA-02',
    status: 'ACTIVE',
    scanCount: 4,
    hazardRatioOverride: 5,
    hazardWeightOverride: 25,
    activationStartsAt: createIsoDate(-180),
    activationEndsAt: null,
  },
  {
    id: 'qr-gamma-03',
    eventId: placeholderEvent.id,
    label: 'Lobby Gamma Sprint',
    value: 80,
    zone: 'Lobby',
    payload: 'VG-GAMMA-03',
    status: 'ACTIVE',
    scanCount: 28,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
    activationStartsAt: createIsoDate(-180),
    activationEndsAt: null,
  },
  {
    id: 'qr-disabled-99',
    eventId: placeholderEvent.id,
    label: 'Compromised Legacy Code',
    value: 200,
    zone: 'Old Stage',
    payload: 'VG-DISABLED-99',
    status: 'DISABLED',
    scanCount: 45,
    hazardRatioOverride: null,
    hazardWeightOverride: null,
    activationStartsAt: createIsoDate(-300),
    activationEndsAt: createIsoDate(-60),
  },
];

export const placeholderRescue: HeliosRescueFlow = {
  id: 'rescue-completed-1',
  playerId: 'player-noah-active',
  eventId: placeholderEvent.id,
  rescuerUserId: 'user-helios-hugo',
  initiatedAt: createIsoDate(-7),
  completedAt: createIsoDate(-6),
  status: 'COMPLETED',
};

/**
 * Returns a cloned team with status and pit expiry overrides applied.
 */
export function withTeamStatus(
  team: Team,
  status: TeamStatus,
  pitStopExpiresAt: string | null
): Team {
  return {
    ...team,
    status,
    pitStopExpiresAt,
  };
}

export const placeholderAudits: AdminAuditEntry[] = [
  {
    id: 'admin-audit-1',
    eventId: placeholderEvent.id,
    actorUserId: 'user-admin-ava',
    actionType: 'RACE_PAUSED',
    targetType: 'EVENT_CONFIG',
    targetId: placeholderEvent.id,
    details: {
      previousState: 'ACTIVE',
      nextState: 'PAUSED',
    },
    createdAt: createIsoDate(-30),
  },
  {
    id: 'admin-audit-2',
    eventId: placeholderEvent.id,
    actorUserId: 'user-admin-ava',
    actionType: 'RACE_RESUMED',
    targetType: 'EVENT_CONFIG',
    targetId: placeholderEvent.id,
    details: {
      previousState: 'PAUSED',
      nextState: 'ACTIVE',
    },
    createdAt: createIsoDate(-28),
  },
];
