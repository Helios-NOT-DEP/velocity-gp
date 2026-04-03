import { SpanStatusCode, trace, type Span } from '@opentelemetry/api';

import { observabilityConfig } from './config';

const tracer = trace.getTracer(observabilityConfig.serviceName);

export interface TraceOptions {
  attributes?: Record<string, string | number | boolean | undefined>;
}

function toAttributes(attributes: TraceOptions['attributes']) {
  return Object.fromEntries(
    Object.entries(attributes ?? {}).filter(([, value]) => value !== undefined)
  );
}

export async function withTelemetrySpan<T>(
  spanName: string,
  options: TraceOptions,
  execute: (span: Span | undefined) => Promise<T>
) {
  return tracer.startActiveSpan(spanName, async (span) => {
    span?.setAttributes(toAttributes(options.attributes));
    let hasErrorStatus = false;
    const wrappedSpan = span
      ? Object.assign(Object.create(span), {
          setStatus(status: Parameters<Span['setStatus']>[0]) {
            if (status.code === SpanStatusCode.ERROR) {
              hasErrorStatus = true;
            }

            return span.setStatus(status);
          },
        })
      : undefined;

    try {
      const result = await execute(wrappedSpan);
      if (!hasErrorStatus) {
        span?.setStatus({ code: SpanStatusCode.OK });
      }
      return result;
    } catch (error) {
      span?.recordException(error as Error);
      span?.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown telemetry error',
      });
      throw error;
    } finally {
      span?.end();
    }
  });
}

export function captureTelemetryError(
  error: unknown,
  attributes?: Record<string, string | number | boolean | undefined>
) {
  tracer.startActiveSpan('ui.error', (span) => {
    span?.setAttributes(toAttributes(attributes));
    span?.recordException(error as Error);
    span?.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown UI error',
    });
    span?.end();
  });
}
