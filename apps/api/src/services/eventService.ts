import type { EventSummary } from '@velocity-gp/api-contract';

import { placeholderEvent } from './placeholderData.js';

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

export function getEvent(eventId: string): EventSummary {
  // TODO: Query event from database
  return {
    ...placeholderEvent,
    id: eventId,
  };
}

export function getCurrentEvent(): EventSummary {
  // TODO: Query current event from database
  return placeholderEvent;
}
