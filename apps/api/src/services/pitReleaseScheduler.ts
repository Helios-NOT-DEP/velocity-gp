import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { releaseExpiredTeamsFromPit } from './pitReleaseService.js';

/**
 * Lightweight interval scheduler that periodically releases teams whose pit
 * lockout window has expired.
 */
let schedulerHandle: ReturnType<typeof globalThis.setInterval> | null = null;
let schedulerTickInFlight = false;

/**
 * Executes a single scheduler tick with in-flight guard protection to avoid
 * overlapping release sweeps.
 */
async function runSchedulerTick(): Promise<void> {
  if (schedulerTickInFlight) {
    return;
  }

  schedulerTickInFlight = true;

  try {
    await releaseExpiredTeamsFromPit();
  } catch (error) {
    logger.error('pit release scheduler tick failed', { err: error });
  } finally {
    schedulerTickInFlight = false;
  }
}

/**
 * Starts the pit release polling loop and returns a stop function.
 */
export function startPitReleaseScheduler(): () => void {
  if (!env.PIT_RELEASE_SCHEDULER_ENABLED) {
    logger.info('pit release scheduler disabled by configuration');
    return stopPitReleaseScheduler;
  }

  if (schedulerHandle) {
    return stopPitReleaseScheduler;
  }

  schedulerHandle = globalThis.setInterval(() => {
    void runSchedulerTick();
  }, env.PIT_RELEASE_POLL_INTERVAL_MS);

  schedulerHandle.unref();
  void runSchedulerTick();

  logger.info('pit release scheduler started', {
    intervalMs: env.PIT_RELEASE_POLL_INTERVAL_MS,
  });

  return stopPitReleaseScheduler;
}

/**
 * Stops the active pit release polling loop, if running.
 */
export function stopPitReleaseScheduler(): void {
  if (!schedulerHandle) {
    return;
  }

  globalThis.clearInterval(schedulerHandle);
  schedulerHandle = null;
  logger.info('pit release scheduler stopped');
}
