import type { EventSummary } from '@velocity-gp/api-contract';

import { placeholderEvent } from './placeholderData.js';

/**
 * Event service used by event-facing API handlers.
 *
 * This module currently returns placeholder-backed values until event persistence
 * is fully wired to the database layer.
 */
export function listEvents(): EventSummary[] {
  // TODO: Query all events from database
  return [
    placeholderEvent,
    {
      id: 'event-456',
      name: 'Velocity GP Night Relay',
      startDate: '2026-05-12T18:00:00.000Z',
      endDate: '2026-05-13T02:00:00.000Z',
      status: 'UPCOMING',
    },
  ];
}

/**
 * Returns a single event summary for the requested ID.
 *
 * The current implementation mirrors placeholder data and swaps only the ID.
 */
export function getEvent(eventId: string): EventSummary {
  // TODO: Query event from database
  return {
    ...placeholderEvent,
    id: eventId,
  };
}

/**
 * Returns the currently active event summary.
 *
 * This is a temporary placeholder implementation.
 */
export function getCurrentEvent(): EventSummary {
  // TODO: Query current event from database
  return placeholderEvent;
}
