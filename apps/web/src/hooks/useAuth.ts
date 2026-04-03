import { useEffect, useState } from 'react';

import { getSession, type AuthSession } from '../services/auth';

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void getSession()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    user: session?.user ?? null,
    session,
    isAuthenticated: Boolean(session?.isAuthenticated && session.user),
    isLoading,
  };
}
