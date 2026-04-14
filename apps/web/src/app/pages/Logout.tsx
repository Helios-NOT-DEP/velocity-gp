import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, LogOut } from 'lucide-react';
import { signOut } from '@/services/auth';

/**
 * Logout page — navigable at /logout for players and admins.
 * Calls signOut() (clears localStorage + invalidates the session cookie)
 * then redirects to the login page.
 */
export default function Logout() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const doLogout = async () => {
      try {
        await signOut();
      } catch {
        // Even if the API call fails we still clear local state (signOut does
        // this in the finally block). Log the failure but continue to redirect.
        if (!cancelled) {
          setError(
            'Session could not be fully invalidated on the server. You have been signed out locally.'
          );
        }
      } finally {
        if (!cancelled) {
          // Short delay so the user sees the "Signed out" confirmation.
          setTimeout(() => {
            if (!cancelled) {
              void navigate('/', { replace: true });
            }
          }, 1500);
        }
      }
    };

    void doLogout();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <LogOut className="w-10 h-10 text-[#00D4FF]" />
        <h1 className="font-['Space_Grotesk'] text-2xl font-bold">Signing out…</h1>
        {error ? (
          <p className="text-sm text-yellow-400 max-w-sm">{error}</p>
        ) : (
          <p className="text-sm text-gray-400">You&apos;ll be redirected to the login page.</p>
        )}
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    </div>
  );
}
