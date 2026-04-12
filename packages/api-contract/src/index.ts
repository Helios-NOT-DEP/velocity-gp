/**
 * @file index.ts
 * @description The main entry point for the `@velocity-gp/api-contract` package.
 * Exports the unified source of truth for the system's endpoints, HTTP structures,
 * strictly-typed DTOs, and Zod schemas. Any consuming project (like `web` or `api`)
 * imports their definitions from here.
 */

export * from './domain.js';
export * from './endpoints.js';
export * from './http.js';

// Aggregate export for strictly-defined business interfaces and DTOs.
export * from './contracts/index.js';

// Aggregate export for runtime validation systems utilizing Zod.
export * from './schemas/index.js';
