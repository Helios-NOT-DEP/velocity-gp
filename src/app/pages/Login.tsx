import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Zap } from 'lucide-react';

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { login } = useGame();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOrPhone && name) {
      login(name, emailOrPhone);
      navigate('/garage');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black" style={{ fontFamily: 'var(--font-body)' }}>
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email or Phone
              </label>
              <input
                type="text"
                placeholder="your@email.com"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90 mt-6"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Continue to Event
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
