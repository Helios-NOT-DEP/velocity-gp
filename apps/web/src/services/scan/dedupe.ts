export interface PayloadDedupeState {
  readonly payload: string;
  readonly timestampMs: number;
}

export const DEFAULT_DEDUPE_WINDOW_MS = 2_500;

export function shouldSuppressDuplicatePayload(
  payload: string,
  currentTimestampMs: number,
  previousState: PayloadDedupeState | null,
  dedupeWindowMs: number = DEFAULT_DEDUPE_WINDOW_MS
): boolean {
  if (!previousState) {
    return false;
  }

  if (previousState.payload !== payload) {
    return false;
  }

  return currentTimestampMs - previousState.timestampMs < dedupeWindowMs;
}

export function createPayloadDedupeState(
  payload: string,
  currentTimestampMs: number
): PayloadDedupeState {
  return {
    payload,
    timestampMs: currentTimestampMs,
  };
}
