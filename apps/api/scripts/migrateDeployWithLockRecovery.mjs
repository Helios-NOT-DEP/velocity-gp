import { spawn } from 'node:child_process';
import { Console } from 'node:console';
import { resolve } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

import { config as loadDotEnv } from 'dotenv';
import pg from 'pg';

const advisoryLockValue = '72707369';
const projectRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const logger = new Console({ stdout: process.stdout, stderr: process.stderr });

loadDotEnv({ path: resolve(projectRoot, '.env.local') });
loadDotEnv({ path: resolve(projectRoot, '.env') });

function resolveDatabaseUrl() {
  const prioritizedSources = [
    process.env['SEED_DATABASE_URL'],
    process.env['DIRECT_DATABASE_URL'],
    process.env['POSTGRES_URL_NON_POOLING'],
    process.env['POSTGRES_URL'],
    process.env['POSTGRES_PRISMA_URL'],
    process.env['DATABASE_URL'],
  ];

  const databaseUrl = prioritizedSources.find(
    (value) => typeof value === 'string' && value.trim().length > 0
  );

  if (!databaseUrl) {
    throw new Error(
      'Unable to recover Prisma advisory lock because no database URL was configured. Set DATABASE_URL, DIRECT_DATABASE_URL, or SEED_DATABASE_URL.'
    );
  }

  return databaseUrl;
}

function runPrismaMigrateDeploy() {
  return new Promise((resolveRun) => {
    const prismaBinPath = resolve(
      projectRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
    );
    const args = ['migrate', 'deploy', '--config', '../../prisma.config.ts'];
    const childProcess = spawn(prismaBinPath, args, {
      cwd: resolve(projectRoot, 'apps/api'),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let combinedOutput = '';

    childProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stdout.write(text);
    });

    childProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stderr.write(text);
    });

    childProcess.on('error', (error) => {
      const errorOutput = `${error instanceof Error ? error.message : String(error)}\n`;
      combinedOutput += errorOutput;
      process.stderr.write(errorOutput);
      resolveRun({ code: 1, output: combinedOutput });
    });

    childProcess.on('close', (code) => {
      resolveRun({ code: code ?? 1, output: combinedOutput });
    });
  });
}

async function recoverStaleAdvisoryLocks() {
  const client = new pg.Client({ connectionString: resolveDatabaseUrl() });

  await client.connect();

  try {
    const staleLockHoldersQuery = await client.query(
      `
        SELECT DISTINCT a.pid
        FROM pg_locks l
        JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.classid = 0
          AND l.objid = $1::int
          AND l.objsubid = 1
          AND a.pid <> pg_backend_pid();
      `,
      [Number(advisoryLockValue)]
    );

    const stalePids = staleLockHoldersQuery.rows
      .map((row) => Number(row.pid))
      .filter((pid) => Number.isInteger(pid) && pid > 0);

    if (stalePids.length === 0) {
      return 0;
    }

    const terminationQuery = await client.query(
      'SELECT pid, pg_terminate_backend(pid) AS terminated FROM unnest($1::int[]) AS pid;',
      [stalePids]
    );

    const terminatedCount = terminationQuery.rows.filter((row) => row.terminated === true).length;

    if (terminatedCount > 0) {
      logger.warn(
        `[migrate-lock-recovery] Released ${terminatedCount} Prisma advisory lock session(s): ${stalePids.join(', ')}.`
      );
    }

    return terminatedCount;
  } finally {
    await client.end();
  }
}

async function main() {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const runAttempt = await runPrismaMigrateDeploy();

    if (runAttempt.code === 0) {
      process.exit(0);
    }

    const isAdvisoryLockTimeout = runAttempt.output.includes(
      'Timed out trying to acquire a postgres advisory lock'
    );

    if (!isAdvisoryLockTimeout) {
      process.exit(runAttempt.code);
    }

    logger.warn(
      `[migrate-lock-recovery] Prisma advisory lock timeout detected (attempt ${attempt}/${maxAttempts}). Attempting stale-lock recovery...`
    );

    const recoveredCount = await recoverStaleAdvisoryLocks();

    if (recoveredCount === 0) {
      logger.warn('[migrate-lock-recovery] No stale lock holders were found to terminate.');
    }

    if (attempt < maxAttempts) {
      logger.warn('[migrate-lock-recovery] Retrying prisma migrate deploy...');
      continue;
    }

    process.exit(runAttempt.code);
  }
}

main().catch((error) => {
  logger.error('[migrate-lock-recovery] Failed:', error);
  process.exit(1);
});
