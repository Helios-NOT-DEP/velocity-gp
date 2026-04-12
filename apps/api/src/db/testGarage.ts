import { prisma } from './client.js';

const teamId = 'team-nova-thunder';
const playerId = 'player-noah-active';

try {
  const [team, approvedCount, mySubmission] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        logoStatus: true,
        requiredPlayerCount: true,
        _count: { select: { players: true } },
      },
    }),
    prisma.garageSubmission.count({
      where: { teamId, status: 'APPROVED' },
    }),
    prisma.garageSubmission.findUnique({
      where: { playerId_teamId: { playerId, teamId } },
      select: { status: true },
    }),
  ]);
  console.log('Team:', JSON.stringify(team));
  console.log('Approved count:', approvedCount);
  console.log('My submission:', JSON.stringify(mySubmission));
} catch (e) {
  const err = e as Error & { code?: string };
  console.error('ERROR:', err.message);
  if (err.code) console.error('CODE:', err.code);
  console.error(err.stack);
} finally {
  await prisma.$disconnect();
}
