#!/usr/bin/env tsx

import { prisma } from '../src/db/client.js';
import { env } from '../src/config/env.js';
import { createMagicLinkToken } from '../src/services/authTokens.js';

interface CliOptions {
  email: string;
  eventId?: string;
  allowUnassigned: boolean;
  json: boolean;
}

interface PlayerContext {
  id: string;
  eventId: string;
  teamId: string | null;
  team: { status: 'PENDING' | 'ACTIVE' | 'IN_PIT' } | null;
  event: { name: string };
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'ADMIN' | 'HELIOS' | 'PLAYER';
  };
}

function printUsage(): void {
  console.log(
    [
      'Generate a local Velocity GP magic link for a user in an ACTIVE event.',
      '',
      'Usage:',
      '  npm run auth:magic-link --workspace=@velocity-gp/api -- --email <user-email> [--event-id <event-id>] [--allow-unassigned] [--json]',
      '',
      'Options:',
      '  --email <value>            Required user email.',
      '  --event-id <value>         Optional event id filter.',
      '  --allow-unassigned         Allow token generation even when player has no team assignment.',
      '  --json                     Print JSON output.',
      '  -h, --help                 Show this help message.',
    ].join('\n')
  );
}

function parseArgs(argv: string[]): CliOptions {
  let email = '';
  let eventId: string | undefined;
  let allowUnassigned = false;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--allow-unassigned') {
      allowUnassigned = true;
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg === '--email') {
      const nextValue = argv[index + 1];
      if (!nextValue) throw new Error('Missing value for --email.');
      email = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--event-id') {
      const nextValue = argv[index + 1];
      if (!nextValue) throw new Error('Missing value for --event-id.');
      eventId = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!email.trim()) {
    throw new Error('Missing required --email argument.');
  }

  return { email: email.trim().toLowerCase(), eventId, allowUnassigned, json };
}

function resolveAssignmentStatus(
  teamId: string | null,
  teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null
) {
  if (!teamId || !teamStatus) return 'UNASSIGNED' as const;
  if (teamStatus === 'PENDING') return 'ASSIGNED_PENDING' as const;
  return 'ASSIGNED_ACTIVE' as const;
}

function resolvePlayerStatusFromTeamStatus(
  status: 'PENDING' | 'ACTIVE' | 'IN_PIT'
): 'RACING' | 'IN_PIT' {
  return status === 'IN_PIT' ? 'IN_PIT' : 'RACING';
}

async function findEligiblePlayer(options: CliOptions): Promise<PlayerContext | null> {
  return prisma.player.findFirst({
    where: {
      user: { email: options.email },
      event: { status: 'ACTIVE' },
      ...(options.eventId ? { eventId: options.eventId } : {}),
    },
    orderBy: { joinedAt: 'desc' },
    select: {
      id: true,
      eventId: true,
      teamId: true,
      team: { select: { status: true } },
      event: { select: { name: true } },
      user: { select: { id: true, email: true, displayName: true, role: true } },
    },
  });
}

async function ensureAdminPlayerContext(options: CliOptions): Promise<PlayerContext> {
  const user = await prisma.user.findUnique({
    where: { email: options.email },
    select: { id: true, email: true, displayName: true, role: true },
  });

  if (!user || user.role !== 'ADMIN') {
    throw new Error(
      `No eligible ACTIVE event player found for ${options.email}${options.eventId ? ` in event ${options.eventId}` : ''}.`
    );
  }

  const event = options.eventId
    ? await prisma.event.findFirst({
        where: { id: options.eventId, status: 'ACTIVE' },
        select: { id: true, name: true },
      })
    : await prisma.event.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true },
      });

  if (!event) {
    throw new Error(
      options.eventId
        ? `Event ${options.eventId} is not ACTIVE or does not exist.`
        : 'No ACTIVE event found.'
    );
  }

  const teams = await prisma.team.findMany({
    where: { eventId: event.id },
    orderBy: { name: 'asc' },
    select: { id: true, status: true },
  });

  const fallbackTeam = teams.find((team) => team.status === 'ACTIVE') ?? teams[0];
  if (!fallbackTeam) {
    throw new Error(`Cannot provision admin player for event ${event.id}: no teams found.`);
  }

  await prisma.player.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    update: {
      teamId: fallbackTeam.id,
      status: resolvePlayerStatusFromTeamStatus(fallbackTeam.status),
    },
    create: {
      userId: user.id,
      eventId: event.id,
      teamId: fallbackTeam.id,
      status: resolvePlayerStatusFromTeamStatus(fallbackTeam.status),
    },
  });

  const provisioned = await prisma.player.findFirst({
    where: { userId: user.id, eventId: event.id, event: { status: 'ACTIVE' } },
    select: {
      id: true,
      eventId: true,
      teamId: true,
      team: { select: { status: true } },
      event: { select: { name: true } },
      user: { select: { id: true, email: true, displayName: true, role: true } },
    },
  });

  if (!provisioned) {
    throw new Error(`Failed to provision admin player for ${options.email}.`);
  }

  return provisioned;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  let player = await findEligiblePlayer(options);
  let autoProvisioned = false;

  if (!player) {
    player = await ensureAdminPlayerContext(options);
    autoProvisioned = true;
  }

  let assignmentStatus = resolveAssignmentStatus(player.teamId, player.team?.status ?? null);
  if (assignmentStatus === 'UNASSIGNED' && player.user.role === 'ADMIN') {
    player = await ensureAdminPlayerContext(options);
    autoProvisioned = true;
    assignmentStatus = resolveAssignmentStatus(player.teamId, player.team?.status ?? null);
  }

  if (assignmentStatus === 'UNASSIGNED' && !options.allowUnassigned) {
    throw new Error(
      'Player is unassigned. Use --allow-unassigned if you intentionally want to generate a token anyway.'
    );
  }

  const token = createMagicLinkToken({
    userId: player.user.id,
    playerId: player.id,
    eventId: player.eventId,
    email: player.user.email,
  });

  const magicLinkUrl = new URL('/login/callback', env.FRONTEND_MAGIC_LINK_ORIGIN);
  magicLinkUrl.searchParams.set('token', token);

  const output = {
    generatedAt: new Date().toISOString(),
    frontendOrigin: env.FRONTEND_MAGIC_LINK_ORIGIN,
    eventId: player.eventId,
    eventName: player.event.name,
    playerId: player.id,
    userId: player.user.id,
    email: player.user.email,
    displayName: player.user.displayName,
    role: player.user.role.toLowerCase(),
    teamId: player.teamId,
    teamStatus: player.team?.status ?? null,
    assignmentStatus,
    autoProvisionedAdminPlayer: autoProvisioned,
    token,
    magicLinkUrl: magicLinkUrl.toString(),
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Email: ${output.email}`);
  console.log(`Role: ${output.role}`);
  console.log(`Event: ${output.eventName} (${output.eventId})`);
  console.log(`Player: ${output.playerId}`);
  console.log(`Assignment: ${output.assignmentStatus}`);
  if (output.autoProvisionedAdminPlayer) {
    console.log('Admin player context was auto-provisioned for this event.');
  }
  console.log('');
  console.log(`Magic Link URL:\n${output.magicLinkUrl}`);
  console.log('');
  console.log(`Token:\n${output.token}`);
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    printUsage();
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
