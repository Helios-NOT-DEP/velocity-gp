import { Prisma } from '../../prisma/generated/client.js';
import { incrementCounter } from '../lib/observability.js';
import { logger } from '../lib/logger.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 25;

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

interface AdapterSerializationCause {
  readonly originalCode?: string;
  readonly kind?: string;
}

interface AdapterSerializationErrorShape {
  readonly name?: string;
  readonly cause?: AdapterSerializationCause;
  readonly message?: string;
}

function isAdapterSerializationFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const adapterError = error as AdapterSerializationErrorShape;
  if (adapterError.name !== 'DriverAdapterError') {
    return false;
  }

  const { originalCode, kind } = adapterError.cause ?? {};
  if (originalCode === '40001') {
    return true;
  }

  if (kind === 'TransactionWriteConflict') {
    return true;
  }

  return adapterError.message?.includes('TransactionWriteConflict') ?? false;
}

/**
 * Returns true for Postgres serialization failures (40001 / P2034) that are
 * safe to retry by re-running the same transaction.
 */
export function isSerializationFailure(error: unknown): boolean {
  return (
    (isKnownPrismaError(error) && error.code === 'P2034') || isAdapterSerializationFailure(error)
  );
}

export interface SerializationRetryOptions {
  readonly maxAttempts?: number;
  /** Base delay in milliseconds for exponential backoff with full jitter. */
  readonly baseDelayMs?: number;
  /** Label used in logs and metrics (e.g. the service name). */
  readonly service?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` and retries up to `maxAttempts` times on Postgres serialization
 * conflicts, using exponential backoff with full random jitter between attempts.
 *
 * Use this wrapper around any `prisma.$transaction` that uses
 * `isolationLevel: Serializable` to prevent P2034 errors from surfacing to
 * callers under concurrent load.
 */
export async function runWithSerializationRetry<T>(
  fn: () => Promise<T>,
  opts: SerializationRetryOptions = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const service = opts.service ?? 'unknown';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = attempt === maxAttempts - 1;
      if (!isSerializationFailure(error) || isLast) {
        if (isLast && isSerializationFailure(error)) {
          logger.error('Serialization conflict: exhausted retry attempts', {
            service,
            maxAttempts,
          });
        }
        throw error;
      }

      // Full-jitter exponential backoff: sleep for a random duration in
      // [0, 2^attempt * baseDelayMs] so retrying threads spread out.
      const delayMs = Math.random() * Math.pow(2, attempt) * baseDelayMs;
      incrementCounter('db.serialization_retry', { service });
      logger.warn('Serialization conflict, retrying with backoff', {
        service,
        attempt: attempt + 1,
        delayMs: Math.round(delayMs),
      });
      await sleep(delayMs);
    }
  }

  // Unreachable — the loop always either returns or throws above.
  throw new Error('runWithSerializationRetry: unreachable');
}
