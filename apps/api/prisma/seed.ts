import 'dotenv/config';

import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for seeding.');
}

const prismaPool = new Pool({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(prismaPool),
  log: ['query', 'error', 'warn'],
});

type EventStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
type PlayerStatus = 'RACING' | 'IN_PIT' | 'FINISHED';
type RaceStatus = 'RACING' | 'IN_PIT' | 'FINISHED';
type RescueStatus = 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED';

interface TeamSeed {
  readonly key: string;
  readonly name: string;
  readonly score: number;
}

interface PlayerSeed {
  readonly key: string;
  readonly email: string;
  readonly name: string;
  readonly teamKey?: string;
  readonly status: PlayerStatus;
}

interface HazardSeed {
  readonly key: string;
  readonly name: string;
  readonly ratio: number;
  readonly description: string;
  readonly location?: string;
  readonly qrCode?: string;
  readonly isActive: boolean;
}

interface RaceSeed {
  readonly playerKey: string;
  readonly teamKey: string;
  readonly status: RaceStatus;
  readonly currentLocation?: string;
  readonly score: number;
  readonly startedAt: Date;
  readonly endedAt?: Date;
  readonly encounteredHazardKeys: readonly string[];
}

interface RescueSeed {
  readonly playerKey: string;
  readonly status: RescueStatus;
  readonly initiatedAt: Date;
  readonly completedAt?: Date;
  readonly reason?: string;
}

interface EventSeed {
  readonly name: string;
  readonly description: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: EventStatus;
  readonly maxPlayers: number;
  readonly isPublic: boolean;
  readonly teams: readonly TeamSeed[];
  readonly players: readonly PlayerSeed[];
  readonly hazards: readonly HazardSeed[];
  readonly races: readonly RaceSeed[];
  readonly rescues: readonly RescueSeed[];
}

interface SeedSummary {
  readonly events: number;
  readonly teams: number;
  readonly players: number;
  readonly hazards: number;
  readonly races: number;
  readonly raceHazards: number;
  readonly rescues: number;
}

const hour = 60 * 60 * 1000;
const presetTeamNames = [
  'Apex Comets',
  'Blaze Falcons',
  'Crimson Foxes',
  'Drift Panthers',
  'Echo Wolves',
  'Flux Mustangs',
  'Glide Hawks',
  'Hyper Lynx',
  'Ion Jaguars',
  'Jetstream Cobras',
  'Kinetic Raptors',
  'Lightning Bulls',
  'Meteor Sharks',
  'Nova Tigers',
  'Orbit Owls',
  'Pulse Vipers',
  'Quantum Bears',
  'Rift Rhinos',
  'Solar Stingrays',
  'Turbo Cougars',
  'Ultraviolet Hornets',
  'Vector Lions',
  'Warp Badgers',
  'Xenon Ravens',
  'Yield Scorpions',
  'Zenith Dragons',
] as const;
const presetPlayerCount = 203;
const seededMaxPlayers = 203;

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * hour);
}

function buildTeams(prefix: string, topScore: number, scoreStep: number): readonly TeamSeed[] {
  return presetTeamNames.map((teamName, index) => ({
    key: `${prefix}-team-${index + 1}`,
    name: `${prefix} ${teamName}`,
    score: Math.max(0, topScore - index * scoreStep),
  }));
}

function buildPlayers(
  prefix: string,
  teamKeys: readonly string[],
  statuses: readonly PlayerStatus[],
  count: number
): readonly PlayerSeed[] {
  const firstNames = [
    'Alex',
    'Jordan',
    'Taylor',
    'Morgan',
    'Casey',
    'Riley',
    'Avery',
    'Skyler',
    'Logan',
    'Jamie',
    'Cameron',
    'Drew',
    'Elliot',
    'Finley',
    'Harper',
    'Hayden',
    'Jules',
    'Kendall',
    'Lane',
    'Micah',
    'Parker',
    'Quinn',
    'Reese',
    'Sawyer',
    'Tatum',
    'Wren',
  ];
  const lastNames = [
    'Velocity',
    'Apex',
    'Drift',
    'Pulse',
    'Rocket',
    'Vortex',
    'Nitro',
    'Zenith',
    'Spark',
    'Orbit',
    'Blitz',
    'Cruise',
    'Dash',
    'Edge',
    'Fusion',
    'Glide',
    'Heat',
    'Ignite',
    'Jet',
    'Kickstart',
    'Launch',
    'Momentum',
    'Overdrive',
    'Pinnacle',
    'Quickshift',
    'Redline',
  ];
  const nameVariants = firstNames.length * lastNames.length;

  return Array.from({ length: count }, (_value, index) => {
    const teamKey = teamKeys[index % teamKeys.length];
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index + 3) % lastNames.length];
    const duplicateSuffix = index >= nameVariants ? ` ${Math.floor(index / nameVariants) + 1}` : '';

    return {
      key: `${prefix}-player-${index + 1}`,
      email: `${prefix}.player${index + 1}@velocity.local`,
      name: `${firstName} ${lastName}${duplicateSuffix}`,
      teamKey,
      status: statuses[index % statuses.length],
    };
  });
}

function buildEventSeeds(): readonly EventSeed[] {
  const completedStart = new Date('2026-03-18T09:00:00.000Z');
  const activeStart = new Date('2026-04-01T10:00:00.000Z');
  const upcomingStart = new Date('2026-04-10T12:00:00.000Z');

  const completedTeams = buildTeams('Helios Retro', 920, 24);
  const activeTeams = buildTeams('Helios Prime', 620, 18);
  const upcomingTeams = buildTeams('Helios Future', 0, 0);

  const completedPlayers = buildPlayers(
    'completed',
    completedTeams.map((team) => team.key),
    ['FINISHED', 'FINISHED', 'IN_PIT', 'RACING'],
    presetPlayerCount
  );
  const activePlayers = buildPlayers(
    'active',
    activeTeams.map((team) => team.key),
    ['RACING', 'IN_PIT', 'FINISHED', 'RACING'],
    presetPlayerCount
  );
  const upcomingPlayers = buildPlayers(
    'upcoming',
    upcomingTeams.map((team) => team.key),
    ['RACING', 'RACING', 'IN_PIT'],
    presetPlayerCount
  );

  const completedHazards: readonly HazardSeed[] = [
    {
      key: 'completed-hz-1',
      name: 'Downtown Congestion',
      ratio: 10,
      description: 'Traffic surge near central plaza',
      location: 'Downtown',
      qrCode: 'QR-COMP-1',
      isActive: true,
    },
    {
      key: 'completed-hz-2',
      name: 'Rain Burst',
      ratio: 15,
      description: 'Sudden rain affecting grip',
      location: 'Harbor Route',
      qrCode: 'QR-COMP-2',
      isActive: true,
    },
    {
      key: 'completed-hz-3',
      name: 'Tunnel Echo',
      ratio: 2.25,
      description: 'Signal bounce in tunnel',
      location: 'North Tunnel',
      qrCode: 'QR-COMP-3',
      isActive: false,
    },
    {
      key: 'completed-hz-4',
      name: 'Bridge Bottleneck',
      ratio: 20,
      description: 'Heavy bridge queue',
      location: 'Unity Bridge',
      qrCode: 'QR-COMP-4',
      isActive: true,
    },
  ];

  const activeHazards: readonly HazardSeed[] = [
    {
      key: 'active-hz-1',
      name: 'Metro Gridlock',
      ratio: 10,
      description: 'Core city congestion',
      location: 'Metro Core',
      qrCode: 'QR-ACT-1',
      isActive: true,
    },
    {
      key: 'active-hz-2',
      name: 'Helios Pulse Zone',
      ratio: 15,
      description: 'High scan pressure corridor',
      location: 'Pulse Sector',
      qrCode: 'QR-ACT-2',
      isActive: true,
    },
    {
      key: 'active-hz-3',
      name: 'Signal Jitter',
      ratio: 1.5,
      description: 'Intermittent route sync issues',
      location: 'Tech Ring',
      qrCode: 'QR-ACT-3',
      isActive: true,
    },
    {
      key: 'active-hz-4',
      name: 'Highway Windshear',
      ratio: 20,
      description: 'Crosswind penalties',
      location: 'Aero Highway',
      qrCode: 'QR-ACT-4',
      isActive: true,
    },
    {
      key: 'active-hz-5',
      name: 'Old Town Maze',
      ratio: 12,
      description: 'Detours through narrow blocks',
      location: 'Old Town',
      qrCode: 'QR-ACT-5',
      isActive: false,
    },
    {
      key: 'active-hz-6',
      name: 'Harbor Lift Delay',
      ratio: 8,
      description: 'Drawbridge timing windows',
      location: 'Harbor Lift',
      qrCode: 'QR-ACT-6',
      isActive: true,
    },
  ];

  const upcomingHazards: readonly HazardSeed[] = [
    {
      key: 'upcoming-hz-1',
      name: 'Sunline Glare',
      ratio: 10,
      description: 'Visibility drop at dusk',
      location: 'Sunline Loop',
      qrCode: 'QR-UP-1',
      isActive: true,
    },
    {
      key: 'upcoming-hz-2',
      name: 'Arena Funnel',
      ratio: 15,
      description: 'Narrowing near arena gates',
      location: 'Arena Approach',
      qrCode: 'QR-UP-2',
      isActive: true,
    },
    {
      key: 'upcoming-hz-3',
      name: 'Dockside Crosswind',
      ratio: 2,
      description: 'Wind drift near docks',
      location: 'Dockside',
      qrCode: 'QR-UP-3',
      isActive: true,
    },
  ];

  const completedRaces: readonly RaceSeed[] = [
    {
      playerKey: completedPlayers[0].key,
      teamKey: completedPlayers[0].teamKey ?? completedTeams[0].key,
      status: 'FINISHED',
      currentLocation: 'Victory Lane',
      score: 420,
      startedAt: addHours(completedStart, 1),
      endedAt: addHours(completedStart, 4),
      encounteredHazardKeys: ['completed-hz-1', 'completed-hz-2'],
    },
    {
      playerKey: completedPlayers[2].key,
      teamKey: completedPlayers[2].teamKey ?? completedTeams[1].key,
      status: 'IN_PIT',
      currentLocation: 'Pit Stop Alpha',
      score: 310,
      startedAt: addHours(completedStart, 2),
      encounteredHazardKeys: ['completed-hz-3'],
    },
    {
      playerKey: completedPlayers[5].key,
      teamKey: completedPlayers[5].teamKey ?? completedTeams[2].key,
      status: 'RACING',
      currentLocation: 'North Tunnel',
      score: 290,
      startedAt: addHours(completedStart, 2.5),
      encounteredHazardKeys: ['completed-hz-4'],
    },
  ];

  const activeRaces: readonly RaceSeed[] = activePlayers.slice(0, 8).map((player, index) => {
    const raceStatus: RaceStatus =
      index % 3 === 0 ? 'RACING' : index % 3 === 1 ? 'IN_PIT' : 'FINISHED';
    const startedAt = addHours(activeStart, 1 + index * 0.5);

    return {
      playerKey: player.key,
      teamKey: player.teamKey ?? activeTeams[index % activeTeams.length].key,
      status: raceStatus,
      currentLocation:
        raceStatus === 'FINISHED'
          ? 'Victory Lane'
          : raceStatus === 'IN_PIT'
            ? 'Pit Delta'
            : 'Metro Core',
      score: 180 + index * 35,
      startedAt,
      endedAt: raceStatus === 'FINISHED' ? addHours(startedAt, 1.25) : undefined,
      encounteredHazardKeys: [
        activeHazards[index % activeHazards.length].key,
        activeHazards[(index + 2) % activeHazards.length].key,
      ],
    };
  });

  const upcomingRaces: readonly RaceSeed[] = upcomingPlayers.slice(0, 3).map((player, index) => ({
    playerKey: player.key,
    teamKey: player.teamKey ?? upcomingTeams[index % upcomingTeams.length].key,
    status: 'RACING',
    currentLocation: 'Grid Staging',
    score: 50 + index * 15,
    startedAt: addHours(upcomingStart, -2 + index),
    encounteredHazardKeys: [upcomingHazards[index % upcomingHazards.length].key],
  }));

  const completedRescues: readonly RescueSeed[] = [
    {
      playerKey: completedPlayers[1].key,
      status: 'COMPLETED',
      initiatedAt: addHours(completedStart, 3.2),
      completedAt: addHours(completedStart, 3.7),
      reason: 'Helios rescue after repeated hazard penalties',
    },
    {
      playerKey: completedPlayers[8].key,
      status: 'IN_PROGRESS',
      initiatedAt: addHours(completedStart, 3.9),
      reason: 'Medical pit extraction in progress',
    },
  ];

  const activeRescues: readonly RescueSeed[] = [
    {
      playerKey: activePlayers[2].key,
      status: 'REQUESTED',
      initiatedAt: addHours(activeStart, 5),
      reason: 'Low energy and hazard overload',
    },
    {
      playerKey: activePlayers[6].key,
      status: 'IN_PROGRESS',
      initiatedAt: addHours(activeStart, 5.4),
      reason: 'Helios dispatch to Pit Bravo',
    },
    {
      playerKey: activePlayers[10].key,
      status: 'COMPLETED',
      initiatedAt: addHours(activeStart, 5.8),
      completedAt: addHours(activeStart, 6.1),
      reason: 'Completed rescue at Aero Highway checkpoint',
    },
  ];

  const upcomingRescues: readonly RescueSeed[] = [
    {
      playerKey: upcomingPlayers[0].key,
      status: 'REQUESTED',
      initiatedAt: addHours(upcomingStart, -1),
      reason: 'Practice-mode rescue drill',
    },
  ];

  return [
    {
      name: 'SEED :: Velocity GP - Championship Finals',
      description: 'Completed historical event used for archival and leaderboard testing.',
      startDate: completedStart,
      endDate: addHours(completedStart, 48),
      status: 'COMPLETED',
      maxPlayers: seededMaxPlayers,
      isPublic: true,
      teams: completedTeams,
      players: completedPlayers,
      hazards: completedHazards,
      races: completedRaces,
      rescues: completedRescues,
    },
    {
      name: 'SEED :: Velocity GP - Helios Active Circuit',
      description: 'Primary active event for gameplay, pit-stop, and rescue flow testing.',
      startDate: activeStart,
      endDate: addHours(activeStart, 72),
      status: 'ACTIVE',
      maxPlayers: seededMaxPlayers,
      isPublic: true,
      teams: activeTeams,
      players: activePlayers,
      hazards: activeHazards,
      races: activeRaces,
      rescues: activeRescues,
    },
    {
      name: 'SEED :: Velocity GP - Next Horizon Qualifier',
      description: 'Upcoming event for onboarding and registration scenario testing.',
      startDate: upcomingStart,
      endDate: addHours(upcomingStart, 36),
      status: 'UPCOMING',
      maxPlayers: seededMaxPlayers,
      isPublic: false,
      teams: upcomingTeams,
      players: upcomingPlayers,
      hazards: upcomingHazards,
      races: upcomingRaces,
      rescues: upcomingRescues,
    },
  ];
}

async function purgeSeedEvents(eventNames: readonly string[]): Promise<void> {
  const existingSeedEvents = await prisma.event.findMany({
    where: {
      name: {
        in: [...eventNames],
      },
    },
    select: {
      id: true,
    },
  });

  if (existingSeedEvents.length === 0) {
    return;
  }

  const eventIds = existingSeedEvents.map((event) => event.id);

  await prisma.$transaction(async (tx) => {
    await tx.raceHazard.deleteMany({
      where: {
        race: {
          eventId: {
            in: eventIds,
          },
        },
      },
    });

    await tx.rescue.deleteMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    await tx.race.deleteMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    await tx.player.deleteMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    await tx.team.deleteMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    await tx.hazard.deleteMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    await tx.event.deleteMany({
      where: {
        id: {
          in: eventIds,
        },
      },
    });
  });
}

async function seedEvent(eventSeed: EventSeed): Promise<SeedSummary> {
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        name: eventSeed.name,
        description: eventSeed.description,
        startDate: eventSeed.startDate,
        endDate: eventSeed.endDate,
        status: eventSeed.status,
        maxPlayers: eventSeed.maxPlayers,
        currentPlayerCount: eventSeed.players.length,
        isPublic: eventSeed.isPublic,
      },
    });

    const teamKeyToId = new Map<string, string>();
    const playerKeyToId = new Map<string, string>();
    const hazardKeyToId = new Map<string, string>();

    for (const team of eventSeed.teams) {
      const createdTeam = await tx.team.create({
        data: {
          name: team.name,
          eventId: event.id,
          score: team.score,
        },
      });

      teamKeyToId.set(team.key, createdTeam.id);
    }

    for (const player of eventSeed.players) {
      const createdPlayer = await tx.player.create({
        data: {
          email: player.email,
          name: player.name,
          eventId: event.id,
          teamId: player.teamKey ? resolveMappedId(teamKeyToId, player.teamKey, 'team') : undefined,
          status: player.status,
        },
      });

      playerKeyToId.set(player.key, createdPlayer.id);
    }

    for (const hazard of eventSeed.hazards) {
      const createdHazard = await tx.hazard.create({
        data: {
          name: hazard.name,
          ratio: hazard.ratio,
          description: hazard.description,
          eventId: event.id,
          location: hazard.location,
          qrCode: hazard.qrCode,
          isActive: hazard.isActive,
        },
      });

      hazardKeyToId.set(hazard.key, createdHazard.id);
    }

    let raceHazardCount = 0;

    for (const race of eventSeed.races) {
      const createdRace = await tx.race.create({
        data: {
          eventId: event.id,
          playerId: resolveMappedId(playerKeyToId, race.playerKey, 'player'),
          teamId: resolveMappedId(teamKeyToId, race.teamKey, 'team'),
          status: race.status,
          currentLocation: race.currentLocation,
          score: race.score,
          startedAt: race.startedAt,
          endedAt: race.endedAt,
        },
      });

      if (race.encounteredHazardKeys.length > 0) {
        await tx.raceHazard.createMany({
          data: race.encounteredHazardKeys.map((hazardKey, index) => ({
            raceId: createdRace.id,
            hazardId: resolveMappedId(hazardKeyToId, hazardKey, 'hazard'),
            encounteredAt: addHours(race.startedAt, (index + 1) * 0.25),
          })),
        });

        raceHazardCount += race.encounteredHazardKeys.length;
      }
    }

    for (const rescue of eventSeed.rescues) {
      await tx.rescue.create({
        data: {
          playerId: resolveMappedId(playerKeyToId, rescue.playerKey, 'player'),
          eventId: event.id,
          status: rescue.status,
          initiatedAt: rescue.initiatedAt,
          completedAt: rescue.completedAt,
          reason: rescue.reason,
        },
      });
    }

    return {
      events: 1,
      teams: eventSeed.teams.length,
      players: eventSeed.players.length,
      hazards: eventSeed.hazards.length,
      races: eventSeed.races.length,
      raceHazards: raceHazardCount,
      rescues: eventSeed.rescues.length,
    } satisfies SeedSummary;
  });

  return result;
}

function mergeSummary(current: SeedSummary, next: SeedSummary): SeedSummary {
  return {
    events: current.events + next.events,
    teams: current.teams + next.teams,
    players: current.players + next.players,
    hazards: current.hazards + next.hazards,
    races: current.races + next.races,
    raceHazards: current.raceHazards + next.raceHazards,
    rescues: current.rescues + next.rescues,
  };
}

function resolveMappedId(map: ReadonlyMap<string, string>, key: string, mapName: string): string {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing ${mapName} mapping for key: ${key}`);
  }

  return value;
}

export async function seedDatabase(): Promise<SeedSummary> {
  const eventSeeds = buildEventSeeds();
  const eventNames = eventSeeds.map((event) => event.name);

  console.info('🌱 Starting Prisma seed with idempotent reset/recreate strategy...');

  await purgeSeedEvents(eventNames);

  let summary: SeedSummary = {
    events: 0,
    teams: 0,
    players: 0,
    hazards: 0,
    races: 0,
    raceHazards: 0,
    rescues: 0,
  };

  for (const eventSeed of eventSeeds) {
    const eventSummary = await seedEvent(eventSeed);
    summary = mergeSummary(summary, eventSummary);
  }

  console.info('✅ Seed completed successfully.');
  console.info('📊 Seed summary:', summary);

  return summary;
}

async function main(): Promise<void> {
  try {
    await seedDatabase();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await prismaPool.end();
  }
}

void main();
