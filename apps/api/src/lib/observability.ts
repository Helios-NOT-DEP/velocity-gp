import { performance } from 'node:perf_hooks';

import { logger } from './logger.js';

type AttributeValue = string | number | boolean | null | undefined;
type SpanAttributes = Record<string, AttributeValue>;

const counters = new Map<string, number>();

function buildCounterKey(name: string, labels: SpanAttributes): string {
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

  logger.debug(
    {
      metric: name,
      labels,
      value: nextValue,
    },
    'counter incremented'
  );

  return nextValue;
}

export async function withTraceSpan<T>(
  spanName: string,
  attributes: SpanAttributes,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();

  logger.debug({ spanName, attributes }, 'span started');

  try {
    const result = await run();
    const durationMs = Number((performance.now() - startedAt).toFixed(3));

    logger.debug({ spanName, attributes, durationMs }, 'span completed');

    return result;
  } catch (error) {
    const durationMs = Number((performance.now() - startedAt).toFixed(3));

    logger.error({ err: error, spanName, attributes, durationMs }, 'span failed');
    throw error;
  }
}
