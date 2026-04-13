import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { resolveScanIdentityForEmail } from '@/services/scan';

const PIT_STATE_POLL_INTERVAL_MS = 5_000;

export default function PitStop() {
  const { gameState, clearPitStop, hydrateScanIdentity } = useGame();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (gameState.currentTeam?.inPitStop) {
      return;
    }

    // Pit-stop route is only valid during lockout.
    navigate('/race', { replace: true });
  }, [gameState.currentTeam?.inPitStop, navigate]);

  useEffect(() => {
    const expiresAt = gameState.currentTeam?.pitStopExpiresAt;
    if (!expiresAt || !gameState.currentTeam?.inPitStop) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expiration = new Date(expiresAt).getTime();
      if (Number.isNaN(expiration)) {
        setTimeLeft(null);
        return;
      }

      const remainingSeconds = Math.max(0, Math.floor((expiration - now) / 1000));
      setTimeLeft(remainingSeconds);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [gameState.currentTeam?.inPitStop, gameState.currentTeam?.pitStopExpiresAt]);

  useEffect(() => {
    if (!gameState.currentTeam?.inPitStop) {
      return;
    }

    let isMounted = true;
    let interval: ReturnType<typeof globalThis.setInterval> | null = null;

    const syncPitState = async () => {
      const resolution = await resolveScanIdentityForEmail(gameState.currentUser?.email);
      if (!isMounted || resolution.status !== 'resolved') {
        return;
      }

      hydrateScanIdentity(resolution.identity);
      if (resolution.identity.teamStatus !== 'IN_PIT') {
        clearPitStop(resolution.identity.teamId);
        navigate('/race', { replace: true });
      }
    };

    void syncPitState();
    interval = globalThis.setInterval(() => {
      void syncPitState();
    }, PIT_STATE_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (interval) {
        globalThis.clearInterval(interval);
      }
    };
  }, [
    clearPitStop,
    gameState.currentTeam?.inPitStop,
    gameState.currentUser?.email,
    hydrateScanIdentity,
    navigate,
  ]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) {
      return '--:--';
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center p-6"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Red accent overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-red-600/20 via-black to-red-900/20 -z-10" />

      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-500/50 animate-pulse">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-bold text-center mb-3 text-white"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          PIT STOP PENALTY
        </h1>
        <p className="text-center text-gray-400 mb-8">Hot Potato hazard detected</p>

        {/* Timer Card */}
        <div className="bg-gray-900 border-2 border-red-500/50 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-red-400" />
            <p className="text-red-400 font-medium">Time Remaining</p>
          </div>

          <div
            className="text-7xl font-bold text-center tabular-nums text-white mb-6"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {formatTime(timeLeft)}
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-center text-red-400 text-sm font-medium">Scanner Disabled</p>
            </div>
          </div>

        {/* Help Text */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <Zap className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <p className="text-white font-semibold mb-1">Need to bypass?</p>
              <p className="text-gray-400 text-sm">
                Find a Helios player and scan their special QR code to request an early pit release.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/race')}
          className="w-full py-4 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Back to Hub
        </button>
      </div>
    </div>
  );
}
