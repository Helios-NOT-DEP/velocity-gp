// Renamed from Login.tsx
// Signup page implementation (migrated from Login.tsx)
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Zap } from 'lucide-react';

import { sendVerificationEmail, savePlayerSession } from '@/services/auth';

// ── Dev-only defaults ─────────────────────────────────────────────────────────
// Used by the "Skip to Garage" shortcut so the Garage page can be exercised
// without going through a real magic-link flow during local development.
// Remove (or guard with import.meta.env.DEV) once Auth.js is wired end-to-end.
// These IDs must match the values in prisma/seed.ts.
const DEV_PLAYER_SESSION = {
  userId: 'user-player-lina',
  email: 'lina@velocitygp.dev',
  playerId: 'player-lina-active',
  teamId: 'team-apex-comets',
  eventId: 'event-velocity-active',
  role: 'player',
} as const;

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');	
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; phoneOrEmail?: string }>({});
  const [submitted, setSubmitted] = useState(false);

	const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.toLowerCase());
	const isValidPhone = (phone: string) => /^\d{10}$/.test(phone);

	const validate = () => {
		const newErrors: { fullName?: string; phoneOrEmail?: string } = {};
		if (!fullName.trim()) newErrors.fullName = 'Full name is required.';
		if (!phoneOrEmail.trim()) {
			newErrors.phoneOrEmail = 'This field is required.';
		} else if (!isValidEmail(phoneOrEmail) && !isValidPhone(phoneOrEmail)) {
			newErrors.phoneOrEmail = 'Enter a valid email or 10-digit phone number.';
		}
		return newErrors;
	};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      // Send magic-link email.
      // TODO(auth): replace with Auth.js signIn('email', { email }) once configured.
      // The `sendVerificationEmail` stub will be swapped for a real implementation
      // when SendGrid + Auth.js are wired (see docs/Tech Stack Needed.md).
      const emailOrPhone = phoneOrEmail.trim();
      if (isValidEmail(emailOrPhone)) {
        await sendVerificationEmail(emailOrPhone).catch(() => {
          // Swallow stub error in dev — real implementation will surface errors properly.
        });
      }
      setSubmitted(true);
    }
  };

  const handleBackToSignup = () => {
    setSubmitted(false);
    setFullName('');
    setPhoneOrEmail('');
    setErrors({});
  };

  /**
   * Dev-only: skip the real magic-link flow by writing a seed player session
   * directly into localStorage and navigating to the Garage page.
   *
   * This simulates what the /auth/callback route will do once Auth.js is live:
   *   1. Auth.js resolves the magic-link token → returns userId + email
   *   2. API call to GET /players/me?eventId=xxx → returns playerId + teamId
   *   3. savePlayerSession() → persists all IDs to localStorage
   *   4. navigate('/garage')
   *
   * Remove this function (and the button that calls it) when Auth.js is wired.
   */
  const handleDevSkipToGarage = () => {
    savePlayerSession(DEV_PLAYER_SESSION);
    navigate('/garage');
  };

	return (
		<div
			className="min-h-screen flex flex-col items-center justify-center p-6 bg-black"
			style={{ fontFamily: 'var(--font-body)' }}
		>
			{/* Gradient background */}
			<div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-black to-orange-600/10" />

			{/* Content */}
			<div className="relative z-10 w-full max-w-md">
				{/* Logo */}
				<div className="mb-12 text-center">
					<div className="inline-flex items-center gap-3 mb-3">
						<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center">
							<Zap className="w-7 h-7 text-white" fill="white" />
						</div>
						<h1
							className="text-5xl font-bold tracking-tight"
							style={{
								fontFamily: 'var(--font-heading)',
								background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
								WebkitBackgroundClip: 'text',
								WebkitTextFillColor: 'transparent',
							}}
						>
							VELOCITY GP
						</h1>
					</div>
					<p className="text-gray-400 text-sm">High-speed gamified racing event</p>
				</div>

				{/* Form Card */}
				<div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
					{!submitted ? (
						<form onSubmit={handleSubmit} className="space-y-5">
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
								<input
									type="text"
									placeholder="Your name"
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									className={`w-full px-4 py-3 bg-black border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.fullName ? 'border-red-500' : 'border-gray-700'}`}
									style={{ fontFamily: 'var(--font-body)' }}
								/>
								{errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
							</div>

							{/* GMF Email field removed */}

							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">Personal Email or Phone</label>
								<input
									type="text"
									placeholder="your@email.com or 10-digit phone"
									value={phoneOrEmail}
									onChange={(e) => setPhoneOrEmail(e.target.value)}
									className={`w-full px-4 py-3 bg-black border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.phoneOrEmail ? 'border-red-500' : 'border-gray-700'}`}
									style={{ fontFamily: 'var(--font-body)' }}
								/>
								{errors.phoneOrEmail && <p className="text-red-500 text-xs mt-1">{errors.phoneOrEmail}</p>}
							</div>

							<button
								type="submit"
								className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 mt-6"
								style={{
									background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
									fontFamily: 'var(--font-body)',
								}}
							>
								Submit
							</button>
						</form>
					) : (
						<div className="text-center py-12">
							<h2 className="text-2xl font-bold mb-4 text-white">Check your inbox</h2>
							<p className="text-gray-300 mb-6">A secure login link has been sent to your email or phone.</p>
							<button
								onClick={handleBackToSignup}
								className="mt-4 px-6 py-2 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-all"
								style={{ fontFamily: 'var(--font-body)' }}
							>
								Back to Signup
							</button>
							{/* DEV ONLY — remove once Auth.js magic-link callback is live */}
							{import.meta.env.DEV && (
								<button
									onClick={handleDevSkipToGarage}
									className="mt-4 ml-3 px-6 py-2 rounded-xl bg-orange-700 text-white font-medium hover:bg-orange-600 transition-all"
									style={{ fontFamily: 'var(--font-body)' }}
								>
									[Dev] Skip to Garage
								</button>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<p className="text-center text-gray-500 text-sm mt-8">
					Powered by <span className="text-blue-400 font-medium">Helios</span>
				</p>
			</div>
		</div>
	);
}
