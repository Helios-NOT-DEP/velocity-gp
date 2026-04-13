import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Loader2, RefreshCw, Zap, Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { getSuperpowerQr, regenerateSuperpowerQr } from '@/services/helios';

export default function HeliosProfile() {
  const { gameState } = useGame();
  const navigate = useNavigate();

  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const playerId = gameState.currentUser?.playerId ?? null;

  useEffect(() => {
    if (!playerId) return;
    let isMounted = true;

    setIsLoadingQr(true);
    setQrError(null);

    getSuperpowerQr(playerId)
      .then((data) => {
        if (isMounted) {
          setQrImageUrl(data.asset.qrImageUrl);
          setIsLoadingQr(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setQrError('Could not load your Superpower QR. Please try again.');
          setIsLoadingQr(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [playerId]);

  const handleRegenerate = useCallback(async () => {
    if (!playerId || isRegenerating) return;

    setIsRegenerating(true);
    setQrError(null);

    try {
      const data = await regenerateSuperpowerQr(playerId);
      setQrImageUrl(data.asset.qrImageUrl);
    } catch {
      setQrError('Could not regenerate your Superpower QR. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }, [playerId, isRegenerating]);

  if (!gameState.currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!gameState.currentUser.isHelios) {
    return <Navigate to="/race" replace />;
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
            <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center relative overflow-hidden">
              {isLoadingQr && (
                <Loader2
                  className="w-12 h-12 text-gray-400 animate-spin"
                  aria-label="Loading QR code"
                />
              )}
              {!isLoadingQr && qrImageUrl && (
                <img
                  src={qrImageUrl}
                  alt="Your Superpower QR code — scan to rescue a penalised team"
                  className="w-full h-full object-contain rounded-xl"
                />
              )}
              {!isLoadingQr && !qrImageUrl && !qrError && (
                <div className="flex flex-col items-center gap-2 text-gray-400 text-sm text-center p-4">
                  <AlertCircle className="w-8 h-8" />
                  <span>QR not available</span>
                </div>
              )}
            </div>
          </div>

          {qrError && (
            <div
              className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{qrError}</p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm">
              <strong>Superpower:</strong> Let penalized teams scan this code to instantly clear
              their Pit Stop timer and get them back in the race.
            </p>
          </div>

          <button
            onClick={handleRegenerate}
            disabled={isRegenerating || isLoadingQr}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Regenerate Superpower QR code"
          >
            <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating…' : 'Regenerate QR'}
          </button>
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
