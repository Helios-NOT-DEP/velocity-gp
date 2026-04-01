import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Scan, Plus } from 'lucide-react';

export default function RaceHub() {
  const { gameState, addScan, triggerPitStop } = useGame();
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    setIsScanning(true);

    setTimeout(() => {
      const randomPoints = Math.random() > 0.7 ? 100 : 50;
      const isHazard = Math.random() > 0.85;

      if (isHazard && gameState.currentTeam) {
        triggerPitStop(gameState.currentTeam.id, 900);
        navigate('/pit-stop');
      } else {
        addScan(randomPoints);
      }

      setIsScanning(false);
    }, 1000);
  };

  if (!gameState.currentTeam) {
    navigate('/garage');
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">{gameState.currentUser?.name}</p>
            <h2
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {gameState.currentTeam.name}
            </h2>
          </div>
          <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Rank</p>
            <p className="text-2xl font-bold text-blue-400">#{gameState.currentTeam.rank || '—'}</p>
          </div>
        </div>

        {/* Score Display */}
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-sm font-medium mb-1">Total Points</p>
          <p
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {gameState.currentTeam.score.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="aspect-square rounded-3xl bg-gradient-to-br from-gray-900 to-black border-2 border-gray-800 relative overflow-hidden flex items-center justify-center mb-6">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-500 rounded-br-3xl" />

            {/* Scanner reticle */}
            <div
              className={`w-48 h-48 border-4 border-blue-500 rounded-2xl transition-all duration-300 ${
                isScanning ? 'scale-95 opacity-50' : 'scale-100 opacity-100'
              }`}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Scan className="w-16 h-16 text-blue-400/40" />
              </div>
            </div>

            {isScanning && <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />}
          </div>

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full py-5 rounded-2xl font-bold text-lg text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
            }}
          >
            <Scan className="w-6 h-6" />
            {isScanning ? 'Scanning...' : 'Scan QR Code'}
          </button>
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-gray-900 border-t border-gray-800 rounded-t-3xl p-6 max-h-80 overflow-y-auto">
        <h3
          className="text-lg font-bold text-white mb-4"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Recent Activity
        </h3>

        {gameState.scans.length === 0 ? (
          <div className="text-center py-8">
            <Scan className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No scans yet. Start scanning QR codes!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {gameState.scans.map((scan) => (
              <div
                key={scan.id}
                className="flex justify-between items-center p-4 bg-black/50 border border-gray-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-green-400 font-bold text-lg">+{scan.points}</p>
                    <p className="text-gray-500 text-xs">{scan.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation moved to RootLayout -> BottomNav */}
    </div>
  );
}
