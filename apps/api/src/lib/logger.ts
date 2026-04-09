import pino from 'pino';

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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = { version: '1.0.0' }; // require(env.packageJson.apiPath);

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
    [ATTR_SERVICE_VERSION]: packageJson.version,
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
const { splat, combine, timestamp, errors, prettyPrint } = winston.format;

const myFormat = winston.format.printf(({ timestamp, label, module, level, message }) => {
  return `${timestamp} [${module || label}] ${level}: ${message}`;
});

// -- Create Winston Logger --
export const logger = winston.createLogger({
  level: logLevel,
  format: combine(timestamp(), splat(), myFormat, prettyPrint(), errors({ stack: true })),
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
  // Error logs
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Combined logs
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
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
