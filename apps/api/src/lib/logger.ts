import pino from 'pino';

import { env } from '../config/env.js';

const logLevel = env.LOG_LEVEL ?? 'info';

const _pino = pino({ level: logLevel });

type LogMetadata = Record<string, unknown> | undefined;

// Dual-convention logger wrapper: accepts both
//   logger.info('message', { meta })   — message-first (Winston/RequestLogger style)
//   logger.info({ meta }, 'message')   — object-first (pino native style)
function makeLogMethod(pinoMethod: (obj: object, msg: string) => void) {
  return (msgOrObj: string | LogMetadata, metaOrMsg?: LogMetadata | string): void => {
    if (typeof msgOrObj === 'string') {
      pinoMethod(metaOrMsg as LogMetadata ?? {}, msgOrObj);
    } else {
      pinoMethod(msgOrObj ?? {}, (metaOrMsg as string) ?? '');
    }
  };
}

export const logger = {
  info: makeLogMethod(_pino.info.bind(_pino)),
  warn: makeLogMethod(_pino.warn.bind(_pino)),
  error: makeLogMethod(_pino.error.bind(_pino)),
  debug: makeLogMethod(_pino.debug.bind(_pino)),
};

// -- Lifecycle stub (OpenTelemetry PostHog flush — no-op until OTel is wired) --
export const flushPostHog = async (): Promise<void> => {
  // TODO: wire up OTel LoggerProvider when PostHog integration is enabled
};

// Create a stream for HTTP request logging middleware
export const httpLoggerStream = {
  write: (message: string) => {
    _pino.info(message.trim());
  },
};

// -- Request-scoped logger --------------------------------------------------------
// Creates a child logger that includes the correlationId on every log line.

export interface RequestLogger {
  error: (message: string, meta?: LogMetadata) => void;
  warn: (message: string, meta?: LogMetadata) => void;
  info: (message: string, meta?: LogMetadata) => void;
  debug: (message: string, meta?: LogMetadata) => void;
}

export function createRequestLogger(correlationId: string): RequestLogger {
  const child = _pino.child({ correlationId });
  return {
    error: (message, meta) => child.error(meta ?? {}, message),
    warn: (message, meta) => child.warn(meta ?? {}, message),
    info: (message, meta) => child.info(meta ?? {}, message),
    debug: (message, meta) => child.debug(meta ?? {}, message),
  };
}
