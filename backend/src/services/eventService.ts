import type { EventSummary } from '../contracts/domain.js';

import { placeholderEvent } from './placeholderData.js';

export function listEvents(): EventSummary[] {
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
  return {
    ...placeholderEvent,
    id: eventId,
  };
}

export function getCurrentEvent(): EventSummary {
  return placeholderEvent;
}
