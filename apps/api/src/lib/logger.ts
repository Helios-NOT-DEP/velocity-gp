import { mkdirSync } from 'node:fs';

import { buildInfo } from '../config/buildInfo.js';
import { env } from '../config/env.js';

// export const logger = pino({
//   level: env.LOG_LEVEL,
// });

/**
 * Winston Logger configuration and helpers for consistent structured logging.
 *
 * @changeHistory
 * - 2025-02-15: Converted to named exports and documented module purpose (GitHub Copilot)
 * - 2025-11-20: Lint fixes - Added explicit return types for request logger helper (GitHub Copilot)
 * - 2025-12-11: Migrated to OpenTelemetry for PostHog logging (Antigravity)
 * - 2025-01-26: Fixed OpenTelemetry setup to use NodeSDK for proper PostHog integration (GitHub Copilot)
 */
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import * as winston from 'winston';

// Initialize configuration
const posthogKey = env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const logLevel = env.LOG_LEVEL || 'info';
const nodeEnv = env.NODE_ENV || 'development';
const serviceName = env.SERVICE_NAME || 'agent-portal-api';

// -- OpenTelemetry Setup --
let loggerProvider: LoggerProvider | null = null;
let otelTransport: OpenTelemetryTransportV3 | null = null;

/* v8 ignore start */
if (posthogKey) {
  // Create a Resource that identifies this service
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: buildInfo.version,
    deploymentEnvironment: nodeEnv,
  });

  // Create the OTLP Log Exporter targeting PostHog
  const logExporter = new OTLPLogExporter({
    url: `${posthogHost}/i/v1/logs`,
    headers: {
      Authorization: `Bearer ${posthogKey}`,
    },
  });

  // Create LoggerProvider with resource and processors
  loggerProvider = new LoggerProvider({
    resource: resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });

  // Register the provider globally
  // Required because OpenTelemetryTransportV3 uses the global logger API
  logs.setGlobalLoggerProvider(loggerProvider);

  // Create the Winston Transport
  otelTransport = new OpenTelemetryTransportV3();
}
/* v8 ignore stop */

// -- Winston Format Setup --
const { splat, combine, timestamp, errors, metadata } = winston.format;

const myFormat = winston.format.printf((info) => {
  const { timestamp, label, module, level, message, service, stack } = info;
  const source = module || label || service || serviceName;
  const renderedMessage = stack || message;
  const extraMetadata =
    info.metadata && Object.keys(info.metadata).length > 0
      ? ` ${JSON.stringify(info.metadata)}`
      : '';

  return `${timestamp} [${source}] ${level}: ${renderedMessage}${extraMetadata}`;
});

// -- Create Winston Logger --
export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    splat(),
    metadata({
      fillExcept: ['timestamp', 'label', 'module', 'level', 'message', 'service', 'stack'],
    }),
    myFormat
  ),
  defaultMeta: {
    service: serviceName,
    environment: nodeEnv,
  },
  transports: [
    // Console output
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Add OpenTelemetry Transport if configured
if (otelTransport) {
  logger.add(otelTransport);
}

// -- File Transports (Production/Dev) --
if (nodeEnv === 'production' || nodeEnv === 'development') {
  const logsDirectory = 'logs';

  try {
    mkdirSync(logsDirectory, { recursive: true });

    // Error logs
    logger.add(
      new winston.transports.File({
        filename: `${logsDirectory}/error.log`,
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );

    // Combined logs
    logger.add(
      new winston.transports.File({
        filename: `${logsDirectory}/combined.log`,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  } catch (error) {
    logger.warn('File logging disabled due to logger directory initialization failure.', {
      logsDirectory,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// -- Lifecycle Helpers --

/**
 * Flushes logs and shuts down the OpenTelemetry SDK.
 * Ensures all logs are sent before application shutdown.
 */
/* v8 ignore start */
export const flushPostHog = async (): Promise<void> => {
  if (loggerProvider) {
    await loggerProvider.shutdown();
  }
};
/* v8 ignore stop */

// Create a stream for Morgan HTTP logging middleware
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// -- Request Logging Helper --

type LogMetadata = Record<string, unknown> | undefined;

interface RequestLogger {
  error: (message: string, meta?: LogMetadata) => void;
  warn: (message: string, meta?: LogMetadata) => void;
  info: (message: string, meta?: LogMetadata) => void;
  debug: (message: string, meta?: LogMetadata) => void;
}

export function createRequestLogger(correlationId: string): RequestLogger {
  return {
    error: (message: string, meta?: LogMetadata) => {
      logger.error(message, { correlationId, ...meta });
    },
    warn: (message: string, meta?: LogMetadata) => {
      logger.warn(message, { correlationId, ...meta });
    },
    info: (message: string, meta?: LogMetadata) => {
      logger.info(message, { correlationId, ...meta });
    },
    debug: (message: string, meta?: LogMetadata) => {
      logger.debug(message, { correlationId, ...meta });
    },
  };
}
