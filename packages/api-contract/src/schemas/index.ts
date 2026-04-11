/**
 * @file index.ts
 * @description Master Barrel exporting all Zod runtime validations.
 * Prevents consumer systems (like backend middleware and frontend React-hook-form resolvers)
 * from having to import specific files individually.
 */

export * from './authSchemas.js';
export * from './adminSchemas.js';
export * from './eventSchemas.js';
export * from './gameSchemas.js';
export * from './hazardSchemas.js';
export * from './playerSchemas.js';
export * from './rescueSchemas.js';
export * from './rosterSchemas.js';
export * from './teamSchemas.js';
export * from './teamActivitySchemas.js';
export * from './emailWebhookSchemas.js';
