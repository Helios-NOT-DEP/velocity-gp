import pino from 'pino';

import { env } from '../config/env.js';

const logLevel = env.LOG_LEVEL ?? 'info';

export const logger = pino({ level: logLevel });

// -- Lifecycle stub (OpenTelemetry PostHog flush — no-op until OTel is wired) --
export const flushPostHog = async (): Promise<void> => {
  // TODO: wire up OTel LoggerProvider when PostHog integration is enabled
};

// Create a stream for HTTP request logging middleware
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// -- Request-scoped logger --------------------------------------------------------
// Creates a child logger that includes the correlationId on every log line.

type LogMetadata = Record<string, unknown> | undefined;

export interface RequestLogger {
  error: (message: string, meta?: LogMetadata) => void;
  warn: (message: string, meta?: LogMetadata) => void;
  info: (message: string, meta?: LogMetadata) => void;
  debug: (message: string, meta?: LogMetadata) => void;
}

export function createRequestLogger(correlationId: string): RequestLogger {
  const child = logger.child({ correlationId });
  return {
    error: (message, meta) => child.error(meta ?? {}, message),
    warn: (message, meta) => child.warn(meta ?? {}, message),
    info: (message, meta) => child.info(meta ?? {}, message),
    debug: (message, meta) => child.debug(meta ?? {}, message),
  };
}
