/**
 * @file index.ts
 * @description Central barrel export file for all Domain Contracts.
 * Consolidates the individual sub-modules covering authentication,
 * participants, game scans, and administrative controls into a single
 * importable surface for the main package structure.
 */

export * from './auth.js';
export * from './adminControls.js';
export * from './participants.js';
export * from './qr.js';
export * from './raceState.js';
export * from './realtime.js';
export * from './roster.js';
export * from './scans.js';
export * from './teamActivity.js';
