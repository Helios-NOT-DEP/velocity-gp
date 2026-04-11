import type { Prisma } from '../../prisma/generated/client.js';
import { ValidationError } from '../utils/appError.js';

/**
 * Shared admin actor resolution utilities.
 *
 * These are used by any service that records admin actions to the audit log.
 * Centralizing here ensures consistent fallback behavior and error messaging
 * across `adminControlService`, `adminQrCodeService`, and `rosterService`.
 */

/**
 * Context carrying the identity of the admin performing an operation.
 * Passed as an optional argument to admin service functions.
 */
export interface AdminActionContext {
  readonly actorUserId?: string;
}

/**
 * Resolves the effective actor user ID for admin audit records within a transaction.
 *
 * When an explicit `actorUserId` is provided and exists in the database, it is used
 * directly. Otherwise, falls back to any ADMIN-role user as a last resort. Throws
 * `ValidationError` if no admin user can be found at all.
 *
 * @param tx - Active Prisma transaction client.
 * @param actorUserId - Optional ID of the actor performing the action.
 */
export async function resolveActorUserId(
  tx: Prisma.TransactionClient,
  actorUserId: string | undefined
): Promise<string> {
  if (actorUserId) {
    const actor = await tx.user.findUnique({
      where: { id: actorUserId },
      select: { id: true },
    });

    if (actor) {
      return actor.id;
    }
  }

  const fallbackAdmin = await tx.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  if (!fallbackAdmin) {
    throw new ValidationError('Unable to resolve admin actor for this operation.', {
      actorUserId,
    });
  }

  return fallbackAdmin.id;
}
