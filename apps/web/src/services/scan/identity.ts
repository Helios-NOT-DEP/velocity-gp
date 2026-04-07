import { apiClient, eventEndpoints, type EventSummary } from '@/services/api';

import type { ScanIdentity, ScanIdentityResolution } from './types';

interface SeededIdentityRecord {
  readonly email: string;
  readonly eventId: string;
  readonly playerId: string;
  readonly teamId: string;
  readonly teamName: string;
}

const seededIdentityByEmail: Record<string, SeededIdentityRecord> = {
  'lina@velocitygp.dev': {
    email: 'lina@velocitygp.dev',
    eventId: 'event-velocity-active',
    playerId: 'player-lina-active',
    teamId: 'team-apex-comets',
    teamName: 'Apex Comets',
  },
  'mason@velocitygp.dev': {
    email: 'mason@velocitygp.dev',
    eventId: 'event-velocity-active',
    playerId: 'player-mason-active',
    teamId: 'team-apex-comets',
    teamName: 'Apex Comets',
  },
  'noah@velocitygp.dev': {
    email: 'noah@velocitygp.dev',
    eventId: 'event-velocity-active',
    playerId: 'player-noah-active',
    teamId: 'team-nova-thunder',
    teamName: 'Nova Thunder',
  },
  'olivia@velocitygp.dev': {
    email: 'olivia@velocitygp.dev',
    eventId: 'event-velocity-active',
    playerId: 'player-olivia-active',
    teamId: 'team-nova-thunder',
    teamName: 'Nova Thunder',
  },
  'parker@velocitygp.dev': {
    email: 'parker@velocitygp.dev',
    eventId: 'event-velocity-active',
    playerId: 'player-parker-active',
    teamId: 'team-drift-runners',
    teamName: 'Drift Runners',
  },
};

function normalizeEmail(email: string | undefined): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function toIdentity(record: SeededIdentityRecord): ScanIdentity {
  return {
    eventId: record.eventId,
    playerId: record.playerId,
    teamId: record.teamId,
    teamName: record.teamName,
    email: record.email,
  };
}

export async function resolveScanIdentityForEmail(
  email: string | undefined
): Promise<ScanIdentityResolution> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {
      status: 'unmapped',
      message:
        'No player email is available in this session. Sign in with a seeded player profile to start scanning.',
    };
  }

  const seededRecord = seededIdentityByEmail[normalizedEmail];
  if (!seededRecord) {
    return {
      status: 'unmapped',
      message:
        'No assigned player profile was found for this email in the current demo roster. Use a seeded event account to scan.',
    };
  }

  let eventResponse;
  try {
    eventResponse = await apiClient.get<EventSummary>(eventEndpoints.getCurrentEvent);
  } catch {
    return {
      status: 'event_unavailable',
      message: 'Current event could not be loaded. Check connectivity and try scanning again.',
    };
  }

  if (!eventResponse.ok) {
    return {
      status: 'event_unavailable',
      message: 'Current event is unavailable right now. Try again in a moment.',
    };
  }

  const currentEventId = eventResponse.data.id;
  if (seededRecord.eventId !== currentEventId) {
    return {
      status: 'event_mismatch',
      message:
        'Your seeded player profile belongs to a different event than the current active event.',
      expectedEventId: seededRecord.eventId,
      currentEventId,
    };
  }

  return {
    status: 'resolved',
    identity: toIdentity(seededRecord),
  };
}

export function getSeededIdentityByEmail(email: string | undefined): ScanIdentity | null {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const seededRecord = seededIdentityByEmail[normalizedEmail];
  return seededRecord ? toIdentity(seededRecord) : null;
}
