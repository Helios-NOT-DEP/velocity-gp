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
      if (!nextValue) {
        throw new Error('Missing value for --email.');
      }

      email = nextValue;
      index += 1;
      continue;
    }

    if (arg === '--event-id') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --event-id.');
      }

      eventId = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!email.trim()) {
    throw new Error('Missing required --email argument.');
  }

  return {
    email: email.trim().toLowerCase(),
    eventId,
    allowUnassigned,
    json,
  };
}

function resolveAssignmentStatus(
  teamId: string | null,
  teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT' | null
) {
  if (!teamId || !teamStatus) {
    return 'UNASSIGNED' as const;
  }

  if (teamStatus === 'PENDING') {
    return 'ASSIGNED_PENDING' as const;
  }

  return 'ASSIGNED_ACTIVE' as const;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const player = await prisma.player.findFirst({
    where: {
      user: {
        email: options.email,
      },
      event: {
        status: 'ACTIVE',
      },
      ...(options.eventId ? { eventId: options.eventId } : {}),
    },
    orderBy: {
      joinedAt: 'desc',
    },
    select: {
      id: true,
      eventId: true,
      teamId: true,
      team: {
        select: {
          status: true,
        },
      },
      event: {
        select: {
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!player) {
    throw new Error(
      `No eligible ACTIVE event player found for ${options.email}${options.eventId ? ` in event ${options.eventId}` : ''}.`
    );
  }

  const assignmentStatus = resolveAssignmentStatus(player.teamId, player.team?.status ?? null);
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

  const magicLinkUrl = new URL('/login/callback', env.FRONTEND_ORIGIN);
  magicLinkUrl.searchParams.set('token', token);

  const output = {
    generatedAt: new Date().toISOString(),
    frontendOrigin: env.FRONTEND_ORIGIN,
    eventId: player.eventId,
    eventName: player.event.name,
    playerId: player.id,
    userId: player.user.id,
    email: player.user.email,
    displayName: player.user.displayName,
    teamId: player.teamId,
    teamStatus: player.team?.status ?? null,
    assignmentStatus,
    token,
    magicLinkUrl: magicLinkUrl.toString(),
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Email: ${output.email}`);
  console.log(`Event: ${output.eventName} (${output.eventId})`);
  console.log(`Player: ${output.playerId}`);
  console.log(`Assignment: ${output.assignmentStatus}`);
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
