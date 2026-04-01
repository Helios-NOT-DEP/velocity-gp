#!/usr/bin/env ts-node

/**
 * Database Seed Script
 *
 * Populates development database with initial data.
 * Run with: npx ts-node scripts/seed.ts
 *
 * Reference: docs/product/Velocity GP BDD Specifications.md
 */

import { prisma } from '../src/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Create a sample event
  const event = await prisma.event.create({
    data: {
      name: 'Velocity GP 2026 Season Opener',
      description: 'First event of the 2026 season',
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-17'),
      status: 'ACTIVE',
      isPublic: true,
      maxPlayers: 100,
    },
  });

  console.log(`✅ Created event: ${event.name}`);

  // Create sample teams
  const team1 = await prisma.team.create({
    data: {
      name: 'Team Velocity',
      eventId: event.id,
      score: 450,
    },
  });

  const team2 = await prisma.team.create({
    data: {
      name: 'Team Lightning',
      eventId: event.id,
      score: 420,
    },
  });

  console.log(`✅ Created teams: ${team1.name}, ${team2.name}`);

  // Create sample players
  const player1 = await prisma.player.create({
    data: {
      email: 'alex@velocity.local',
      name: 'Alex Champion',
      eventId: event.id,
      teamId: team1.id,
      status: 'RACING',
    },
  });

  const player2 = await prisma.player.create({
    data: {
      email: 'jordan@velocity.local',
      name: 'Jordan Swift',
      eventId: event.id,
      teamId: team2.id,
      status: 'IN_PIT',
    },
  });

  console.log(`✅ Created players: ${player1.name}, ${player2.name}`);

  // Create sample hazards
  const hazard1 = await prisma.hazard.create({
    data: {
      name: 'Traffic Jam',
      ratio: 10,
      description: 'Navigate through heavy traffic',
      eventId: event.id,
      location: 'Downtown District',
      isActive: true,
    },
  });

  const hazard2 = await prisma.hazard.create({
    data: {
      name: 'Weather Delay',
      ratio: 15,
      description: 'Unexpected weather conditions',
      eventId: event.id,
      location: 'Highway Sector',
      isActive: true,
    },
  });

  console.log(`✅ Created hazards: ${hazard1.name}, ${hazard2.name}`);

  // Create a sample race
  const race = await prisma.race.create({
    data: {
      eventId: event.id,
      playerId: player1.id,
      teamId: team1.id,
      status: 'RACING',
      currentLocation: 'Downtown District',
      score: 450,
    },
  });

  console.log(`✅ Created race for ${player1.name}`);

  console.log('\n✨ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
