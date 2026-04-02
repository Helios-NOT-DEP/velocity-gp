import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Trophy, Users, AlertTriangle, Award, ArrowLeft, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function VictoryLane() {
  const { gameState } = useGame();
  const navigate = useNavigate();
  const confettiTriggered = useRef(false);

  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  const winners = sortedTeams.slice(0, 3);
  const totalScans = gameState.teams.reduce((sum, team) => sum + team.score, 0);
  const totalPitStops = 12;
  const mvpPlayer = 'Sarah Chen';

  useEffect(() => {
    if (!confettiTriggered.current) {
      confettiTriggered.current = true;

      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#3B82F6', '#F97316'],
        });

        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#3B82F6', '#F97316'],
        });
      }, 50);
    }
  }, []);

  const podiumHeights = ['h-96', 'h-80', 'h-80'];
  const podiumColors = [
    {
      gradient: 'from-yellow-500 to-orange-500',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
    },
    { gradient: 'from-gray-400 to-gray-500', border: 'border-gray-400/50', text: 'text-gray-300' },
    {
      gradient: 'from-orange-600 to-orange-700',
      border: 'border-orange-500/50',
      text: 'text-orange-400',
    },
  ];

  return (
    <div className="min-h-screen bg-black p-6 lg:p-12" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/leaderboard')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Leaderboard
      </button>

      {/* Header */}
      <div className="max-w-6xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full mb-6">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-yellow-400">Championship Complete</span>
        </div>

        <h1
          className="text-6xl lg:text-8xl font-bold mb-4"
          style={{
            fontFamily: 'var(--font-heading)',
            background: 'linear-gradient(135deg, #FFD700 0%, #F97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          VICTORY LANE
        </h1>
        <p className="text-gray-400 text-xl">72-Hour Championship Winners</p>
      </div>

      {/* Podium */}
      <div className="max-w-6xl mx-auto mb-16">
        <div className="flex items-end justify-center gap-6">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <div
              className={`w-64 ${podiumHeights[1]} bg-gray-900 border-2 ${podiumColors[1].border} rounded-t-3xl p-6 flex flex-col items-center justify-center mb-4`}
            >
              <div
                className="w-32 h-32 rounded-2xl bg-cover bg-center border-4 border-gray-400 mb-4 shadow-xl"
                style={{
                  backgroundImage:
                    'url(https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&h=400&fit=crop)',
                }}
              />
              <h3
                className="text-xl font-bold text-white text-center mb-2"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {winners[1]?.name}
              </h3>
              <p
                className={`text-3xl font-bold ${podiumColors[1].text}`}
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {winners[1]?.score.toLocaleString()}
              </p>
            </div>
            <div
              className={`w-64 h-32 bg-gradient-to-b ${podiumColors[1].gradient} rounded-b-3xl flex items-center justify-center shadow-2xl`}
            >
              <span
                className="text-6xl font-bold text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                2
              </span>
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center -mt-8">
            <Trophy className="w-12 h-12 text-yellow-400 mb-4 drop-shadow-2xl" />
            <div
              className={`w-72 ${podiumHeights[0]} bg-gray-900 border-2 ${podiumColors[0].border} rounded-t-3xl p-6 flex flex-col items-center justify-center mb-4`}
            >
              <div
                className="w-40 h-40 rounded-2xl bg-cover bg-center border-4 border-yellow-500 mb-4 shadow-2xl shadow-yellow-500/50"
                style={{
                  backgroundImage:
                    'url(https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&h=400&fit=crop)',
                }}
              />
              <h3
                className="text-2xl font-bold text-white text-center mb-2"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {winners[0]?.name}
              </h3>
              <p
                className={`text-4xl font-bold ${podiumColors[0].text}`}
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {winners[0]?.score.toLocaleString()}
              </p>
            </div>
            <div
              className={`w-72 h-40 bg-gradient-to-b ${podiumColors[0].gradient} rounded-b-3xl flex items-center justify-center shadow-2xl shadow-yellow-500/30`}
            >
              <span
                className="text-7xl font-bold text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                1
              </span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <div
              className={`w-64 ${podiumHeights[2]} bg-gray-900 border-2 ${podiumColors[2].border} rounded-t-3xl p-6 flex flex-col items-center justify-center mb-4`}
            >
              <div
                className="w-32 h-32 rounded-2xl bg-cover bg-center border-4 border-orange-600 mb-4 shadow-xl"
                style={{
                  backgroundImage:
                    'url(https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&h=400&fit=crop)',
                }}
              />
              <h3
                className="text-xl font-bold text-white text-center mb-2"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {winners[2]?.name}
              </h3>
              <p
                className={`text-3xl font-bold ${podiumColors[2].text}`}
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {winners[2]?.score.toLocaleString()}
              </p>
            </div>
            <div
              className={`w-64 h-32 bg-gradient-to-b ${podiumColors[2].gradient} rounded-b-3xl flex items-center justify-center shadow-2xl`}
            >
              <span
                className="text-6xl font-bold text-white"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                3
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Event Stats */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <Users className="w-10 h-10 text-blue-400 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Total Scans</p>
          <p
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {totalScans.toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Pit Stops</p>
          <p
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {totalPitStops}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <Award className="w-10 h-10 text-green-400 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">MVP Player</p>
          <p
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {mvpPlayer}
          </p>
        </div>
      </div>
    </div>
  );
}
