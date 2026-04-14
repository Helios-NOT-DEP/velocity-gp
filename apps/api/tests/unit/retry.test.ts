import { describe, expect, it, vi, beforeEach } from 'vitest';

import { Prisma } from '../../prisma/generated/client.js';
import { isSerializationFailure, runWithSerializationRetry } from '../../src/db/retry.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/lib/observability.js', () => ({
  incrementCounter: vi.fn(),
}));

vi.mock('../../src/lib/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Speed up tests — collapse all sleeps to zero.
vi.mock('../../src/db/retry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/retry.js')>();
  return {
    ...actual,
  };
});

// Override setTimeout to resolve immediately so tests don't sleep.
vi.stubGlobal('setTimeout', (fn: () => void) => {
  fn();
  return 0 as unknown as ReturnType<typeof setTimeout>;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePrismaP2034(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Transaction conflict', {
    code: 'P2034',
    clientVersion: '7.0.0',
  });
}

function makeDriverAdapterError(kind: string, originalCode: string): object {
  return {
    name: 'DriverAdapterError',
    cause: { kind, originalCode },
    message: `Transaction write conflict: ${originalCode}`,
  };
}

function makeGenericError(): Error {
  return new Error('Something else went wrong');
}

// ---------------------------------------------------------------------------
// isSerializationFailure
// ---------------------------------------------------------------------------

describe('isSerializationFailure', () => {
  it('detects Prisma P2034 error', () => {
    expect(isSerializationFailure(makePrismaP2034())).toBe(true);
  });

  it('detects driver adapter error with originalCode 40001', () => {
    expect(
      isSerializationFailure(makeDriverAdapterError('TransactionWriteConflict', '40001'))
    ).toBe(true);
  });

  it('detects driver adapter error with kind TransactionWriteConflict', () => {
    expect(
      isSerializationFailure(makeDriverAdapterError('TransactionWriteConflict', '99999'))
    ).toBe(true);
  });

  it('returns false for non-serialization Prisma errors', () => {
    const err = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: '7.0.0',
    });
    expect(isSerializationFailure(err)).toBe(false);
  });

  it('returns false for plain Error', () => {
    expect(isSerializationFailure(makeGenericError())).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(isSerializationFailure(null)).toBe(false);
    expect(isSerializationFailure(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runWithSerializationRetry
// ---------------------------------------------------------------------------

describe('runWithSerializationRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns result immediately when fn succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await runWithSerializationRetry(fn, { service: 'test' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds after two serialization failures', async () => {
    const p2034 = makePrismaP2034();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(p2034)
      .mockRejectedValueOnce(p2034)
      .mockResolvedValue('recovered');

    const result = await runWithSerializationRetry(fn, { service: 'test', maxAttempts: 5 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-serialization errors immediately without retrying', async () => {
    const err = makeGenericError();
    const fn = vi.fn().mockRejectedValue(err);

    await expect(runWithSerializationRetry(fn, { service: 'test' })).rejects.toThrow(
      'Something else went wrong'
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows after exhausting maxAttempts', async () => {
    const p2034 = makePrismaP2034();
    const fn = vi.fn().mockRejectedValue(p2034);

    await expect(runWithSerializationRetry(fn, { service: 'test', maxAttempts: 3 })).rejects.toBe(
      p2034
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries with driver adapter 40001 error', async () => {
    const adapterErr = makeDriverAdapterError('TransactionWriteConflict', '40001');
    const fn = vi.fn().mockRejectedValueOnce(adapterErr).mockResolvedValue('recovered');

    const result = await runWithSerializationRetry(fn, { service: 'test' });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
