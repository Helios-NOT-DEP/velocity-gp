import 'dotenv/config';

import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import { resolveSeedDatabaseUrl } from '../src/db/resolveSeedDatabaseUrl.js';

const { url: databaseUrl } = resolveSeedDatabaseUrl();

const prismaPool = new Pool({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(prismaPool),
  log: ['query', 'error', 'warn'],
});

interface SeedSummary {
  readonly users: number;
  readonly events: number;
  readonly eventConfigs: number;
  readonly teams: number;
  readonly players: number;
  readonly qrCodes: number;
  readonly qrCodeClaims: number;
  readonly scanRecords: number;
  readonly rescues: number;
  readonly teamStateTransitions: number;
  readonly adminActionAudits: number;
}

const now = new Date('2026-04-06T12:00:00.000Z');
const minutes = (value: number) => 60_000 * value;
const hours = (value: number) => 60 * minutes(value);

const ids = {
  users: {
    admin: 'user-admin-ava',
    heliosOne: 'user-helios-hugo',
    heliosTwo: 'user-helios-iris',
    heliosAdmin: 'user-helios-admin-hello',
    racerOne: 'user-player-lina',
    racerTwo: 'user-player-mason',
    racerThree: 'user-player-noah',
    racerFour: 'user-player-olivia',
    racerFive: 'user-player-parker',
    ankit: 'user-player-ankit',
    neerPatel: 'admin-player-neer',
  },
  events: {
    active: 'event-velocity-active',
    upcoming: 'event-velocity-upcoming',
  },
  teams: {
    apex: 'team-apex-comets',
    nova: 'team-nova-thunder',
    drift: 'team-drift-runners',
  },
  players: {
    lina: 'player-lina-active',
    mason: 'player-mason-active',
    noah: 'player-noah-active',
    olivia: 'player-olivia-active',
    parker: 'player-parker-active',
    ankit: 'player-ankit-active',
    neer: 'player-neer-active',
  },
  qrCodes: {
    alpha: 'qr-alpha-01',
    beta: 'qr-beta-02',
    gamma: 'qr-gamma-03',
    superpowerHugo: 'qr-helios-hugo',
    disabled: 'qr-disabled-99',
  },
  rescues: {
    completed: 'rescue-completed-1',
    rejected: 'rescue-rejected-1',
  },
};

async function clearDatabase(): Promise<void> {
  await prisma.adminActionAudit.deleteMany();
  await prisma.teamStateTransition.deleteMany();
  await prisma.teamActivityEvent.deleteMany();
  await prisma.rescue.deleteMany();
  await prisma.scanRecord.deleteMany();
  await prisma.qRCodeClaim.deleteMany();
  // SuperpowerQRAsset references User with ON DELETE RESTRICT, remove assets first
  await prisma.superpowerQRAsset.deleteMany();
  await prisma.player.deleteMany();
  await prisma.qRCode.deleteMany();
  await prisma.team.deleteMany();
  await prisma.eventConfig.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers(): Promise<void> {
  await prisma.user.createMany({
    data: [
      {
        id: ids.users.admin,
        email: 'admin@velocitygp.dev',
        displayName: 'Ava Admin',
        role: 'ADMIN',
        canAdmin: true,
        canPlayer: false,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.heliosOne,
        email: 'hugo.helios@velocitygp.dev',
        displayName: 'Hugo Helios',
        role: 'HELIOS',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: true,
        isHelios: true,
      },
      {
        id: ids.users.heliosTwo,
        email: 'iris.helios@velocitygp.dev',
        displayName: 'Iris Helios',
        role: 'HELIOS',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: true,
        isHelios: true,
      },
      {
        id: ids.users.heliosAdmin,
        email: 'hello@velocitygp.app',
        displayName: 'Helios Admin',
        role: 'ADMIN',
        canAdmin: true,
        canPlayer: false,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.racerOne,
        email: 'lina@velocitygp.dev',
        displayName: 'Lina Lane',
        role: 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.racerTwo,
        email: 'mason@velocitygp.dev',
        displayName: 'Mason Momentum',
        role: 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.racerThree,
        email: 'noah@velocitygp.dev',
        displayName: 'Noah Nitro',
        role: 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.racerFour,
        email: 'olivia@velocitygp.dev',
        displayName: 'Olivia Orbit',
        role: 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.racerFive,
        email: 'parker@velocitygp.dev',
        displayName: 'Parker Pulse',
        role: 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.ankit,
        email: 'jn.ankit@yahoo.com',
        displayName: 'Ankit',
        role: 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: false,
        isHelios: false,
      },
      {
        id: ids.users.neerPatel,
        email: 'neerpatel@gmail.com',
        displayName: 'Neer Patel',
        role: 'ADMIN',
        canAdmin: true,
        canPlayer: true,
        isHeliosMember: true,
        isHelios: true,
      },
    ],
  });
}

async function seedEventsAndConfig(): Promise<void> {
  await prisma.event.createMany({
    data: [
      {
        id: ids.events.active,
        name: 'Velocity GP Spring Finals',
        description: 'Live race event with pit-stop hazards and rescue mechanics.',
        startDate: new Date(now.getTime() - hours(3)),
        endDate: new Date(now.getTime() + hours(6)),
        status: 'ACTIVE',
        maxPlayers: 120,
        currentPlayerCount: 5,
        venueId: 'venue-hq-atrium',
        isPublic: true,
      },
      {
        id: ids.events.upcoming,
        name: 'Velocity GP Sunset Sprint',
        description: 'Upcoming warmup event with no active scans yet.',
        startDate: new Date(now.getTime() + hours(48)),
        endDate: new Date(now.getTime() + hours(54)),
        status: 'UPCOMING',
        maxPlayers: 80,
        currentPlayerCount: 0,
        venueId: 'venue-west-campus',
        isPublic: true,
      },
    ],
  });

  await prisma.eventConfig.createMany({
    data: [
      {
        eventId: ids.events.active,
        globalHazardRatio: 15,
        pitStopDurationSeconds: 900,
        invalidScanPenalty: 1,
        raceControlState: 'ACTIVE',
      },
      {
        eventId: ids.events.upcoming,
        globalHazardRatio: 12,
        pitStopDurationSeconds: 600,
        invalidScanPenalty: 1,
        raceControlState: 'PAUSED',
      },
    ],
  });
}

async function seedTeamsPlayersAndQrCodes(): Promise<void> {
  await prisma.team.createMany({
    data: [
      {
        id: ids.teams.apex,
        eventId: ids.events.active,
        name: 'Apex Comets',
        score: 1260,
        status: 'ACTIVE',
        pitStopExpiresAt: null,
      },
      {
        id: ids.teams.nova,
        eventId: ids.events.active,
        name: 'Nova Thunder',
        score: 920,
        status: 'IN_PIT',
        pitStopExpiresAt: new Date(now.getTime() + minutes(11)),
      },
      {
        id: ids.teams.drift,
        eventId: ids.events.active,
        name: 'Drift Runners',
        score: 1110,
        status: 'ACTIVE',
        pitStopExpiresAt: new Date(now.getTime() - minutes(4)),
      },
    ],
  });

  await prisma.player.createMany({
    data: [
      {
        id: ids.players.lina,
        userId: ids.users.racerOne,
        eventId: ids.events.active,
        teamId: ids.teams.apex,
        status: 'RACING',
        individualScore: 430,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - hours(2)),
      },
      {
        id: ids.players.mason,
        userId: ids.users.racerTwo,
        eventId: ids.events.active,
        teamId: ids.teams.apex,
        status: 'RACING',
        individualScore: 390,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - hours(2)),
      },
      {
        id: ids.players.noah,
        userId: ids.users.racerThree,
        eventId: ids.events.active,
        teamId: ids.teams.nova,
        status: 'IN_PIT',
        individualScore: 250,
        isFlaggedForReview: true,
        joinedAt: new Date(now.getTime() - hours(2)),
      },
      {
        id: ids.players.olivia,
        userId: ids.users.racerFour,
        eventId: ids.events.active,
        teamId: ids.teams.nova,
        status: 'IN_PIT',
        individualScore: 265,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - hours(2)),
      },
      {
        id: ids.players.parker,
        userId: ids.users.racerFive,
        eventId: ids.events.active,
        teamId: ids.teams.drift,
        status: 'RACING',
        individualScore: 355,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - hours(2)),
      },
      {
        id: ids.players.ankit,
        userId: ids.users.ankit,
        eventId: ids.events.active,
        teamId: ids.teams.drift,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - minutes(5)),
      },
      {
        id: ids.players.neer,
        userId: ids.users.neerPatel,
        eventId: ids.events.active,
        teamId: ids.teams.apex,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - minutes(5)),
      },
    ],
  });

  await prisma.qRCode.createMany({
    data: [
      {
        id: ids.qrCodes.alpha,
        eventId: ids.events.active,
        label: 'Atrium Checkpoint Alpha',
        value: 100,
        zone: 'Atrium',
        payload: 'VG-ALPHA-01',
        status: 'ACTIVE',
        activationStartsAt: new Date(now.getTime() - hours(2)),
        activationEndsAt: null,
        hazardRatioOverride: null,
        hazardWeightOverride: null,
        scanCount: 14,
      },
      {
        id: ids.qrCodes.beta,
        eventId: ids.events.active,
        label: 'Rooftop Beta Boost',
        value: 120,
        zone: 'Rooftop',
        payload: 'VG-BETA-02',
        status: 'ACTIVE',
        activationStartsAt: new Date(now.getTime() - hours(2)),
        activationEndsAt: null,
        hazardRatioOverride: 5,
        hazardWeightOverride: 25,
        scanCount: 4,
      },
      {
        id: ids.qrCodes.gamma,
        eventId: ids.events.active,
        label: 'Lobby Gamma Sprint',
        value: 80,
        zone: 'Lobby',
        payload: 'VG-GAMMA-03',
        status: 'ACTIVE',
        activationStartsAt: new Date(now.getTime() - hours(2)),
        activationEndsAt: null,
        hazardRatioOverride: null,
        hazardWeightOverride: null,
        scanCount: 28,
      },
      {
        id: ids.qrCodes.superpowerHugo,
        eventId: ids.events.active,
        label: 'Helios Rescue QR - Hugo',
        value: 0,
        zone: 'Helios Booth',
        payload: 'VG-HELIOS-HUGO',
        status: 'ACTIVE',
        activationStartsAt: new Date(now.getTime() - hours(2)),
        activationEndsAt: null,
        hazardRatioOverride: null,
        hazardWeightOverride: null,
        scanCount: 7,
      },
      {
        id: ids.qrCodes.disabled,
        eventId: ids.events.active,
        label: 'Compromised Legacy Code',
        value: 200,
        zone: 'Old Stage',
        payload: 'VG-DISABLED-99',
        status: 'DISABLED',
        activationStartsAt: new Date(now.getTime() - hours(5)),
        activationEndsAt: new Date(now.getTime() - hours(1)),
        hazardRatioOverride: null,
        hazardWeightOverride: null,
        scanCount: 45,
      },
    ],
  });
}

async function seedGeneratedTeamsAndPlayers(numTeams = 10, playersPerTeam = 8): Promise<void> {
  // Generate teams, users and players programmatically.
  const teamsData: Array<{
    id: string;
    eventId: string;
    name: string;
    score: number;
    status: string;
    pitStopExpiresAt: Date | null;
  }> = [];

  const usersData: Array<{
    id: string;
    email: string;
    displayName: string;
    role: string;
    canAdmin: boolean;
    canPlayer: boolean;
    isHeliosMember: boolean;
    isHelios: boolean;
  }> = [];

  const playersData: Array<{
    id: string;
    userId: string;
    eventId: string;
    teamId: string;
    status: string;
    individualScore: number;
    isFlaggedForReview: boolean;
    joinedAt: Date;
  }> = [];

  for (let t = 1; t <= numTeams; t++) {
    const teamId = `team-gen-${String(t).padStart(2, '0')}`;
    teamsData.push({
      id: teamId,
      eventId: ids.events.active,
      name: `Generated Team ${t}`,
      score: Math.floor(Math.random() * 1000),
      status: 'ACTIVE',
      pitStopExpiresAt: null,
    });

    // Each team gets `playersPerTeam` players; the first player is a Helios player.
    for (let p = 1; p <= playersPerTeam; p++) {
      const isHelios = p === 1;
      const userId = isHelios ? `user-helios-gen-${t}` : `user-player-gen-${t}-${p}`;
      usersData.push({
        id: userId,
        email: `${userId}@velocitygp.dev`,
        displayName: isHelios ? `Helios Gen ${t}` : `Player Gen ${t}-${p}`,
        role: isHelios ? 'HELIOS' : 'PLAYER',
        canAdmin: false,
        canPlayer: true,
        isHeliosMember: isHelios,
        isHelios,
      });

      playersData.push({
        id: `player-gen-${t}-${p}`,
        userId,
        eventId: ids.events.active,
        teamId,
        status: 'RACING',
        individualScore: 0,
        isFlaggedForReview: false,
        joinedAt: new Date(now.getTime() - minutes(5)),
      });
    }
  }

  if (teamsData.length) {
    // Cast to `any` to satisfy the generated Prisma input types for enums
    await prisma.team.createMany({ data: teamsData as any });
  }

  if (usersData.length) {
    await prisma.user.createMany({ data: usersData as any });
  }

  if (playersData.length) {
    await prisma.player.createMany({ data: playersData as any });
  }
}

async function seedGeneratedQRCodes(count = 45): Promise<void> {
  const data: Array<{
    id: string;
    eventId: string;
    label: string;
    value: number;
    zone: string;
    payload: string;
    status: string;
    activationStartsAt: Date | null;
    activationEndsAt: Date | null;
    hazardRatioOverride: number | null;
    hazardWeightOverride: number | null;
    scanCount: number;
  }> = [];

  for (let i = 1; i <= count; i++) {
    const idx = String(i).padStart(3, '0');
    data.push({
      id: `qr-gen-${idx}`,
      eventId: ids.events.active,
      label: `Generated QR ${idx}`,
      value: Math.floor(Math.random() * 150) + 25,
      zone: `Generated Zone ${Math.ceil(i / 10)}`,
      payload: `VG-GEN-QR-${idx}`,
      status: 'ACTIVE',
      activationStartsAt: new Date(now.getTime() - hours(2)),
      activationEndsAt: null,
      hazardRatioOverride: null,
      hazardWeightOverride: null,
      scanCount: 0,
    });
  }

  if (data.length) {
    await prisma.qRCode.createMany({ data: data as any });
  }
}

async function seedClaimsScansRescuesAndAudits(): Promise<void> {
  await prisma.qRCodeClaim.createMany({
    data: [
      {
        id: 'claim-lina-alpha',
        eventId: ids.events.active,
        qrCodeId: ids.qrCodes.alpha,
        playerId: ids.players.lina,
        claimedAt: new Date(now.getTime() - minutes(14)),
      },
      {
        id: 'claim-parker-gamma',
        eventId: ids.events.active,
        qrCodeId: ids.qrCodes.gamma,
        playerId: ids.players.parker,
        claimedAt: new Date(now.getTime() - minutes(16)),
      },
    ],
  });

  await prisma.scanRecord.createMany({
    data: [
      {
        id: 'scan-safe-1',
        eventId: ids.events.active,
        qrCodeId: ids.qrCodes.gamma,
        playerId: ids.players.parker,
        teamId: ids.teams.drift,
        outcome: 'SAFE',
        pointsAwarded: 80,
        hazardRatioUsed: 15,
        globalScanCountBefore: 27,
        globalScanCountAfter: 28,
        scannedPayload: 'VG-GAMMA-03',
        message: 'Safe scan awarded points.',
        createdAt: new Date(now.getTime() - minutes(16)),
      },
      {
        id: 'scan-hazard-1',
        eventId: ids.events.active,
        qrCodeId: ids.qrCodes.alpha,
        playerId: ids.players.noah,
        teamId: ids.teams.nova,
        outcome: 'HAZARD_PIT',
        pointsAwarded: 0,
        hazardRatioUsed: 15,
        globalScanCountBefore: 14,
        globalScanCountAfter: 15,
        scannedPayload: 'VG-ALPHA-01',
        message: 'Modulo trigger moved team to IN_PIT.',
        createdAt: new Date(now.getTime() - minutes(12)),
      },
      {
        id: 'scan-invalid-1',
        eventId: ids.events.active,
        qrCodeId: null,
        playerId: ids.players.noah,
        teamId: ids.teams.nova,
        outcome: 'INVALID',
        pointsAwarded: -1,
        hazardRatioUsed: null,
        globalScanCountBefore: null,
        globalScanCountAfter: null,
        scannedPayload: 'VG-UNKNOWN-404',
        message: 'Unknown code, player flagged for review.',
        createdAt: new Date(now.getTime() - minutes(10)),
      },
      {
        id: 'scan-duplicate-1',
        eventId: ids.events.active,
        qrCodeId: ids.qrCodes.alpha,
        playerId: ids.players.lina,
        teamId: ids.teams.apex,
        outcome: 'DUPLICATE',
        pointsAwarded: 0,
        hazardRatioUsed: 15,
        globalScanCountBefore: 15,
        globalScanCountAfter: 15,
        scannedPayload: 'VG-ALPHA-01',
        message: 'Already claimed by this player.',
        createdAt: new Date(now.getTime() - minutes(9)),
      },
      {
        id: 'scan-blocked-1',
        eventId: ids.events.active,
        qrCodeId: ids.qrCodes.disabled,
        playerId: ids.players.mason,
        teamId: ids.teams.apex,
        outcome: 'BLOCKED',
        pointsAwarded: 0,
        hazardRatioUsed: null,
        globalScanCountBefore: 45,
        globalScanCountAfter: 45,
        scannedPayload: 'VG-DISABLED-99',
        message: 'Code disabled by admin control.',
        createdAt: new Date(now.getTime() - minutes(8)),
      },
    ],
  });

  await prisma.rescue.createMany({
    data: [
      {
        id: ids.rescues.completed,
        eventId: ids.events.active,
        requestingPlayerId: ids.players.noah,
        requestingTeamId: ids.teams.nova,
        rescuerUserId: ids.users.heliosOne,
        status: 'COMPLETED',
        reason: 'Superpower QR scan accepted.',
        initiatedAt: new Date(now.getTime() - minutes(7)),
        completedAt: new Date(now.getTime() - minutes(6)),
        cooldownExpiresAt: new Date(now.getTime() - minutes(3)),
      },
      {
        id: ids.rescues.rejected,
        eventId: ids.events.active,
        requestingPlayerId: ids.players.olivia,
        requestingTeamId: ids.teams.nova,
        rescuerUserId: ids.users.heliosTwo,
        status: 'REJECTED',
        reason: 'SELF_RESCUE_FORBIDDEN',
        initiatedAt: new Date(now.getTime() - minutes(5)),
        completedAt: null,
        cooldownExpiresAt: null,
      },
    ],
  });

  await prisma.teamStateTransition.createMany({
    data: [
      {
        id: 'team-transition-1',
        eventId: ids.events.active,
        teamId: ids.teams.nova,
        fromStatus: 'ACTIVE',
        toStatus: 'IN_PIT',
        reason: 'HAZARD_TRIGGER',
        triggeredByPlayerId: ids.players.noah,
        notes: '15th scan trigger fired for QR Alpha.',
        createdAt: new Date(now.getTime() - minutes(12)),
      },
      {
        id: 'team-transition-2',
        eventId: ids.events.active,
        teamId: ids.teams.nova,
        fromStatus: 'IN_PIT',
        toStatus: 'ACTIVE',
        reason: 'RESCUE_CLEARED',
        triggeredByUserId: ids.users.heliosOne,
        notes: 'Helios rescue completed.',
        createdAt: new Date(now.getTime() - minutes(6)),
      },
      {
        id: 'team-transition-3',
        eventId: ids.events.active,
        teamId: ids.teams.drift,
        fromStatus: 'IN_PIT',
        toStatus: 'ACTIVE',
        reason: 'TIMER_EXPIRED',
        triggeredByUserId: ids.users.admin,
        notes: 'Server-side expiry automation simulation.',
        createdAt: new Date(now.getTime() - minutes(4)),
      },
      {
        id: 'team-transition-4',
        eventId: ids.events.active,
        teamId: ids.teams.nova,
        fromStatus: 'ACTIVE',
        toStatus: 'IN_PIT',
        reason: 'ADMIN_MANUAL',
        triggeredByUserId: ids.users.admin,
        notes: 'Manual pit-stop override for demonstration.',
        createdAt: new Date(now.getTime() - minutes(2)),
      },
    ],
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-1',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'RACE_PAUSED',
      targetType: 'EVENT_CONFIG',
      targetId: ids.events.active,
      details: {
        previousState: 'ACTIVE',
        nextState: 'PAUSED',
      },
      createdAt: new Date(now.getTime() - minutes(30)),
    },
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-2',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'RACE_RESUMED',
      targetType: 'EVENT_CONFIG',
      targetId: ids.events.active,
      details: {
        previousState: 'PAUSED',
        nextState: 'ACTIVE',
      },
      createdAt: new Date(now.getTime() - minutes(28)),
    },
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-3',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'HELIOS_ASSIGNED',
      targetType: 'USER',
      targetId: ids.users.racerFive,
      details: {
        assignedRole: 'HELIOS',
      },
      createdAt: new Date(now.getTime() - minutes(20)),
    },
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-4',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'HELIOS_REVOKED',
      targetType: 'USER',
      targetId: ids.users.racerFive,
      details: {
        revokedRole: 'HELIOS',
      },
      createdAt: new Date(now.getTime() - minutes(18)),
    },
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-5',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'PIT_MANUAL_ENTER',
      targetType: 'TEAM',
      targetId: ids.teams.nova,
      details: {
        reason: 'Crowd-control intervention',
      },
      createdAt: new Date(now.getTime() - minutes(2)),
    },
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-6',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'PIT_MANUAL_CLEAR',
      targetType: 'TEAM',
      targetId: ids.teams.drift,
      details: {
        reason: 'Timer reconciliation correction',
      },
      createdAt: new Date(now.getTime() - minutes(3)),
    },
  });

  await prisma.adminActionAudit.create({
    data: {
      id: 'admin-audit-7',
      eventId: ids.events.active,
      actorUserId: ids.users.admin,
      actionType: 'SCORE_RESET',
      targetType: 'EVENT',
      targetId: ids.events.active,
      details: {
        scope: 'DRY_RUN_ONLY',
      },
      createdAt: new Date(now.getTime() - minutes(1)),
    },
  });
}

async function getSeedSummary(): Promise<SeedSummary> {
  const [
    users,
    events,
    eventConfigs,
    teams,
    players,
    qrCodes,
    qrCodeClaims,
    scanRecords,
    rescues,
    teamStateTransitions,
    adminActionAudits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.count(),
    prisma.eventConfig.count(),
    prisma.team.count(),
    prisma.player.count(),
    prisma.qRCode.count(),
    prisma.qRCodeClaim.count(),
    prisma.scanRecord.count(),
    prisma.rescue.count(),
    prisma.teamStateTransition.count(),
    prisma.adminActionAudit.count(),
  ]);

  return {
    users,
    events,
    eventConfigs,
    teams,
    players,
    qrCodes,
    qrCodeClaims,
    scanRecords,
    rescues,
    teamStateTransitions,
    adminActionAudits,
  };
}

async function main(): Promise<void> {
  await clearDatabase();
  await seedUsers();
  await seedEventsAndConfig();
  await seedTeamsPlayersAndQrCodes();
  // Generate additional QR codes
  await seedGeneratedQRCodes(45);
  // Generate additional teams and players (10 teams × 8 players each, 1 Helios per team)
  await seedGeneratedTeamsAndPlayers(10, 8);
  await seedClaimsScansRescuesAndAudits();

  const summary = await getSeedSummary();
  console.log('Seed complete:');
  console.table(summary);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaPool.end();
  });
