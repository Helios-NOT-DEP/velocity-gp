// Minimal auth context propagated through middleware into protected handlers.
export type AuthRole = 'admin' | 'helios' | 'player';

export interface AuthCapabilities {
  admin: boolean;
  player: boolean;
  heliosMember: boolean;
}

export interface RequestAuthContext {
  userId: string;
  playerId?: string;
  role?: AuthRole;
  capabilities: AuthCapabilities;
}
