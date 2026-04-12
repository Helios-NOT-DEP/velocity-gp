import { performance } from 'node:perf_hooks';

import { logger } from './logger.js';

type AttributeValue = string | number | boolean | null | undefined;
type SpanAttributes = Record<string, AttributeValue>;

const counters = new Map<string, number>();

function buildCounterKey(name: string, labels: SpanAttributes): string {
  // Sort labels for deterministic metric keys regardless of call-site object ordering.
  const sortedLabels = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');

  return sortedLabels ? `${name}|${sortedLabels}` : name;
}

export function incrementCounter(
  name: string,
  labels: SpanAttributes = {},
  incrementBy: number = 1
): number {
  const key = buildCounterKey(name, labels);
  const nextValue = (counters.get(key) ?? 0) + incrementBy;
  counters.set(key, nextValue);

  logger.debug('counter incremented', {
    metric: name,
    labels,
    value: nextValue,
  });

  return nextValue;
}

export async function withTraceSpan<T>(
  spanName: string,
  attributes: SpanAttributes,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();

  logger.debug('span started', { spanName, attributes });

  try {
    const result = await run();
    const durationMs = Number((performance.now() - startedAt).toFixed(3));

    logger.debug('span completed', { spanName, attributes, durationMs });

    return result;
  } catch (error) {
    const durationMs = Number((performance.now() - startedAt).toFixed(3));

    logger.error('span failed', { err: error, spanName, attributes, durationMs });
    throw error;
  }
}
