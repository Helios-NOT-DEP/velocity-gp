/**
 * Event Domain Models
 *
 * Types for events, venues, and event configuration.
 *
 * @module models/event
 */

export interface Event {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  maxPlayers?: number;
  currentPlayerCount: number;
  venueId?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  capacity: number;
  eventIds: string[]; // Events held at this venue
}

export interface EventConfig {
  eventId: string;
  maxTeamSize: number;
  scoringMode: 'standard' | 'handicap' | 'custom';
  enableHeliosRescue: boolean;
  rescueBonus: number;
  baseScore: number;
}
