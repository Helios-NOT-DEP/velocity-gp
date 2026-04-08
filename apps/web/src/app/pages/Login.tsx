import React, { useState } from 'react';
import { requestMagicLink } from '@/services/auth';
import backgroundImage from '@/assets/login-background.png';
import logoImage from '@/assets/velocity-gp-logo.png';

export default function Login() {
  const [workEmail, setWorkEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workEmail.trim()) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await requestMagicLink(workEmail.trim());
      setMessage(response.message);
    } catch {
      setError('Unable to request a sign-in link right now. Please try again.');
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
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-3 relative h-[100px]">
          <img
            src={logoImage}
            alt="Velocity GP"
            className="absolute left-1/2 -translate-x-1/2 top-0 w-[550px] max-w-none h-auto pointer-events-none select-none"
          />
        </div>
        <p className="text-gray-400 text-sm text-center mb-8">High-speed race to the checkered code.</p>

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
