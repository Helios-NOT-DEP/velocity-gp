export * from './contracts/auth.js';
export * from './contracts/adminControls.js';
export * from './contracts/participants.js';
export * from './contracts/qr.js';
export * from './contracts/raceState.js';
export * from './contracts/realtime.js';
export * from './contracts/scans.js';

// Legacy alias retained for compatibility with older callers.
export type RaceStatus = 'IN_PIT' | 'RACING' | 'FINISHED';
