import { z } from 'zod';

export const requestMagicLinkSchema = z.object({
  workEmail: z.string().email(),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});
