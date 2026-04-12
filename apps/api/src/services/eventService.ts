import type { EventSummary } from '@velocity-gp/api-contract';

import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/appError.js';

/**
 * Event service used by event-facing API handlers.
 *
 * All functions query the database directly via Prisma and map
 * `Event` records to the `EventSummary` contract type.
 */

function toEventSummary(event: {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
}): EventSummary {
  return {
    id: event.id,
    name: event.name,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    status: event.status,
  };
}

/**
 * Returns all events ordered by most recently updated.
 */
export async function listEvents(): Promise<EventSummary[]> {
  const events = await prisma.event.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  return events.map(toEventSummary);
}

/**
 * Returns a single event by ID.
 *
 * @throws {NotFoundError} if the event does not exist.
 */
export async function getEvent(eventId: string): Promise<EventSummary> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found.', { eventId });
  }

  return toEventSummary(event);
}

/**
 * Returns the currently active event.
 *
 * @throws {NotFoundError} if no event has status ACTIVE.
 */
export async function getCurrentEvent(): Promise<EventSummary> {
  const event = await prisma.event.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!event) {
    throw new NotFoundError('No active event found.');
  }

  return toEventSummary(event);
}
