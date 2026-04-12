import React from 'react';
import { useNavigate } from 'react-router';
import { Scan, Trophy, User } from 'lucide-react';
import { useGame } from '@/app/context/GameContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const { gameState } = useGame();
  const showHeliosButton = gameState.currentUser?.isHelios === true;

  return (
    // Fixed navigation shell for race routes; route-level pages own the main content area.
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 p-4 flex gap-3">
      <button
        onClick={() => navigate('/race')}
        className="flex-1 py-3 rounded-xl font-semibold bg-blue-500 text-white flex items-center justify-center gap-2"
      >
        <Scan className="w-5 h-5" />
        Scanner
      </button>
      <button
        onClick={() => navigate('/leaderboard')}
        className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
      >
        <Trophy className="w-5 h-5" />
        Ranks
      </button>
      {showHeliosButton && (
        <button
          onClick={() => navigate('/helios')}
          className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <User className="w-5 h-5" />
          Helios
        </button>
      )}
    </div>
  );
}
