import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import BottomNav from '../components/ui/BottomNav';
import { AUTH_SESSION_UPDATED_EVENT, anonymousSession, getSession, type AuthSession } from '@/services/auth';

export default function RootLayout() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSession>(anonymousSession);

  useEffect(() => {
    let active = true;

    const refreshSession = async () => {
      const next = await getSession();
      if (!active) {
        return;
      }
      setSession(next);
    };

    void refreshSession();
    const onSessionUpdated = () => {
      void refreshSession();
    };
    globalThis.addEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated);
    return () => {
      active = false;
      globalThis.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated);
    };
  }, []);

  const canSwitchToAdmin =
    session.capabilities?.admin === true && session.capabilities?.player === true;

  return (
    <>
      {/* Reserve bottom padding so page content is not hidden behind fixed mobile nav. */}
      <div className="min-h-screen pb-24">
        {canSwitchToAdmin && (
          <div className="sticky top-3 z-40 flex justify-end px-4">
            <button
              onClick={() => navigate('/admin/game-control')}
              className="rounded-full border border-blue-400/40 bg-[#0B1E3B]/90 px-3 py-1 text-xs font-semibold text-blue-200"
            >
              Switch to Admin
            </button>
          </div>
        )}
        <Outlet />
      </div>
      {/* Shared player navigation for race-hub/pit-stop/leaderboard/profile routes. */}
      <BottomNav />
    </>
  );
}
