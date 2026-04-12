/**
 * @file authSchemas.ts
 * @description Contains runtime validation constraints for authentication mechanics.
 * Safeguards inputs against script injection strings when users first pass their email
 * or click a generated authorization token URL.
 */

import { z } from 'zod';

/** Validates the format of an email address requesting to start a passwordless authentication flow. */
export const requestMagicLinkSchema = z.object({
  workEmail: z.string().email(),
});

/** Validates that a magic link token passed matches expected constraints before DB evaluation. */
export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});
