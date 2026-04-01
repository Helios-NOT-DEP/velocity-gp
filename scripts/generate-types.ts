#!/usr/bin/env ts-node

/**
 * Type Generation Script
 *
 * Generates TypeScript types from database schema.
 * Run with: npx ts-node scripts/generate-types.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('📝 Generating types from Prisma schema...');

  try {
    await execAsync('npx prisma generate');
    console.log('✅ Types generated successfully');
  } catch (error) {
    console.error('❌ Type generation failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
