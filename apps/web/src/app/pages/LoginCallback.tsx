import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { verifyMagicLink } from '@/services/auth';

export default function LoginCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    const params = new globalThis.URLSearchParams(location.search);
    return params.get('token');
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    async function verifyAndRoute(): Promise<void> {
      if (!token) {
        setError('Sign-in link is missing a token. Request a new link.');
        return;
      }

      try {
        // Verify token server-side and use backend-provided redirect for assignment-aware routing.
        const verification = await verifyMagicLink(token);
        if (cancelled) {
          return;
        }

        navigate(verification.redirectPath, { replace: true });
      } catch (verificationError) {
        if (cancelled) {
          return;
        }

        const code =
          verificationError instanceof Error ? verificationError.message : 'AUTH_INVALID_LINK';
        if (code === 'AUTH_ASSIGNMENT_REQUIRED') {
          // Explicit unassigned path keeps onboarding messaging deterministic.
          navigate('/waiting-assignment', { replace: true });
          return;
        }

        setError('This sign-in link is invalid or expired. Request a new link.');
      }
    }

    void verifyAndRoute();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">Signing You In</h1>
        {!error ? (
          <p className="text-gray-300">Verifying your secure magic link.</p>
        ) : (
          <>
            <p className="text-red-300 mb-5">{error}</p>
            <Link
              to="/"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
