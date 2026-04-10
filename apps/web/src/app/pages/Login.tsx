import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getSession, requestMagicLink } from '@/services/auth';
import backgroundImage from '@/assets/login-background.png';
import logoImage from '@/assets/velocity-gp-logo.png';

export default function Login() {
  // TODO(figma-sync): Reintroduce dual-field login capture (`Email or Phone` + `Full Name`) to match updated onboarding contract before Garage handoff. | Figma source: src/app/pages/Login.tsx form inputs | Impact: user flow
  const [workEmail, setWorkEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function redirectIfAuthenticated() {
      const session = await getSession();
      if (!isMounted || !session.isAuthenticated || !session.userId) {
        return;
      }

      if (session.role === 'admin') {
        navigate('/admin/game-control', { replace: true });
        return;
      }

      if (session.assignmentStatus === 'UNASSIGNED') {
        navigate('/waiting-assignment', { replace: true });
        return;
      }

      if (session.assignmentStatus === 'ASSIGNED_PENDING') {
        navigate('/garage', { replace: true });
        return;
      }

      navigate('/race-hub', { replace: true });
    }

    void redirectIfAuthenticated();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workEmail.trim()) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      // TODO(figma-sync): Align submit transition with Figma's immediate Garage navigation flow, while preserving magic-link security requirements. | Figma source: src/app/pages/Login.tsx handleSubmit (navigate('/garage')) | Impact: user flow
      // Current behavior intentionally stays on this screen and shows server response
      // because auth requires external email-link verification.
      const response = await requestMagicLink(workEmail.trim());
      setMessage(response.message);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message === 'AUTH_USER_NOT_FOUND') {
        setError('No user found for this work email.');
      } else {
        setError('Unable to request a sign-in link right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-black relative overflow-hidden"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[448px]">
        {/* Logo */}
        <div className="mb-5 relative h-[100px] md:h-[170px]">
          <div className="absolute left-1/2 -translate-x-1/2 w-[380px] h-[140px] -top-[20px] md:translate-x-0 md:-top-[-15px] md:-left-[16px] md:w-[480px] md:h-[170px]">
            <img
              src={logoImage}
              alt="Velocity GP"
              className="absolute inset-0 max-w-none object-cover pointer-events-none size-full"
            />
          </div>
        </div>
        <p className="text-gray-400 text-sm text-center mb-8">
          High-speed race to the checkered code.
        </p>

        {/* Form Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Work Email</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>

            {message && (
              <p className="text-sm rounded-lg border border-green-700 bg-green-900/40 px-3 py-2 text-green-200">
                {message}
              </p>
            )}

            {error && (
              <p className="text-sm rounded-lg border border-red-700 bg-red-900/40 px-3 py-2 text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 mt-6"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {submitting ? 'Sending Link...' : 'Email Me a Sign-In Link'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Powered by <span className="text-blue-400 font-medium">Helios</span>
        </p>
      </div>
    </div>
  );
}
