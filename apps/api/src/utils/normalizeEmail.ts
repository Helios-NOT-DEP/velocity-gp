/**
 * Shared email normalization utility.
 *
 * Used by `authService` and `rosterService` to normalize work email addresses
 * before database lookups, ensuring consistent casing and whitespace handling.
 */

/**
 * Normalizes a work email address for stable, case-insensitive lookups.
 * Trims surrounding whitespace and converts to lowercase.
 */
export function normalizeWorkEmail(email: string): string {
  return email.trim().toLowerCase();
}
