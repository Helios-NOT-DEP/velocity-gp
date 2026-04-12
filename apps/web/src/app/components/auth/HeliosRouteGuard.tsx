import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import {
  anonymousSession,
  getSession,
  isAuthenticatedSession,
  isHeliosMemberSession,
  type AuthSession,
} from '@/services/auth';

interface Props {
  children: React.ReactNode;
}

export default function HeliosRouteGuard({ children }: Props) {
  const [session, setSession] = useState<AuthSession>(anonymousSession);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const nextSession = await getSession();
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <main
        className="min-h-screen bg-[#040A16] text-white flex items-center justify-center"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <p className="text-sm tracking-wide text-blue-200/80">Loading Helios access…</p>
      </main>
    );
  }

  if (!isAuthenticatedSession(session)) {
    return <Navigate to="/" replace />;
  }

  if (!isHeliosMemberSession(session)) {
    return <Navigate to="/race" replace />;
  }

  return <>{children}</>;
}
