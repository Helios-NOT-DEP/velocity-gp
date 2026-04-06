export type AuthRole = 'admin' | 'helios' | 'player';

export interface RequestAuthContext {
  userId: string;
  role: AuthRole;
}
