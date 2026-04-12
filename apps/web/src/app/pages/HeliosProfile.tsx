import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Zap, Shield, ArrowLeft } from 'lucide-react';

export default function HeliosProfile() {
  const { gameState } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (gameState.currentUser && !gameState.currentUser.isHelios) {
      navigate('/race', { replace: true });
    }
  }, [gameState.currentUser, navigate]);

  if (!gameState.currentUser) {
    navigate('/');
    return null;
  }

  if (!gameState.currentUser.isHelios) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black p-6" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/race')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        {/* Profile Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/50">
            <Zap className="w-12 h-12 text-white" fill="white" />
          </div>

          <h1
            className="text-3xl font-bold text-white mb-2"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {gameState.currentUser.name}
          </h1>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-orange-500 rounded-full">
            <Shield className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-sm">HELIOS CREATOR</span>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
          <h2
            className="text-xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Rescue QR Code
          </h2>

          <div className="bg-white rounded-2xl p-6 mb-6">
            {/* QR Code */}
            <div className="aspect-square bg-black rounded-xl flex items-center justify-center relative overflow-hidden">
              {/* Simplified QR pattern */}
              <div className="grid grid-cols-8 grid-rows-8 gap-1 w-full h-full p-6">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{
                      background: Math.random() > 0.5 ? '#000' : '#fff',
                    }}
                  />
                ))}
              </div>

              {/* Center logo */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Zap className="w-8 h-8 text-white" fill="white" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm">
              <strong>Superpower:</strong> Let penalized teams scan this code to instantly clear
              their Pit Stop timer and get them back in the race.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Teams Rescued</p>
            <p
              className="text-4xl font-bold text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              4
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Active Teams</p>
            <p
              className="text-4xl font-bold text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {gameState.teams.length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/leaderboard')}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
            }}
          >
            View Leaderboard
          </button>

          <button
            onClick={() => navigate('/victory-lane')}
            className="w-full py-4 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Victory Lane
          </button>
        </div>
      </div>
    </div>
  );
}
