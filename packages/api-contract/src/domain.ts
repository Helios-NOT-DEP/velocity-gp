/**
 * @file domain.ts
 * @description Serves as the central export module, bundling together all business-logic
 * Data Transfer Objects (DTOs) and domain level types. Both the React UI and the Express API
 * utilize these unified types.
 */

// Domain-level contract exports used by both API and frontend consumers.
export * from './contracts/auth.js';
export * from './contracts/adminControls.js';
export * from './contracts/participants.js';
export * from './contracts/qr.js';
export * from './contracts/raceState.js';
export * from './contracts/realtime.js';
export * from './contracts/roster.js';
export * from './contracts/scans.js';

// Legacy alias retained for compatibility with older callers over older API versions.
/** Represents the macro-status of an ongoing race event. */
export type RaceStatus = 'IN_PIT' | 'RACING' | 'FINISHED';
