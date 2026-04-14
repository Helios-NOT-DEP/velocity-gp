import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { SubmitScanResponse } from '@velocity-gp/api-contract';
import { apiClient, scanEndpoints } from '@/services/api';
import { resolveScanIdentityForEmail, mapScanResponseToUiAction } from '@/services/scan';
import { useGame } from '../context/GameContext';

type Phase = 'loading' | 'error';

export default function ScanRedirect() {
  const { payload } = useParams<{ payload: string }>();
  const navigate = useNavigate();
  const { gameState, applyScanOutcome } = useGame();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function processScan() {
      if (!payload) {
        setErrorMessage('No QR payload found in this URL.');
        setPhase('error');
        return;
      }

      const resolution = await resolveScanIdentityForEmail(gameState.currentUser?.email);
      if (cancelled) {
        return;
      }

      if (resolution.status !== 'resolved') {
        setErrorMessage(
          resolution.message ?? 'Could not load your player profile for the active event.'
        );
        setPhase('error');
        return;
      }

      const identity = resolution.identity;

      let response: Awaited<ReturnType<typeof apiClient.post<SubmitScanResponse>>>;
      try {
        response = await apiClient.post<SubmitScanResponse>(
          scanEndpoints.submitScan(identity.eventId),
          {
            playerId: identity.playerId,
            qrPayload: payload,
          }
        );
      } catch {
        if (cancelled) {
          return;
        }
        setErrorMessage(
          'Scan submission failed due to a network error. Please retry from Race Hub.'
        );
        setPhase('error');
        return;
      }

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setErrorMessage('Scan could not be processed. Please retry from Race Hub.');
        setPhase('error');
        return;
      }

      applyScanOutcome(response.data);
      const uiAction = mapScanResponseToUiAction(response.data);
      navigate(uiAction.navigateTo ?? '/race', { replace: true });
    }

    void processScan();

    return () => {
      cancelled = true;
    };
  }, [payload, gameState.currentUser?.email, navigate, applyScanOutcome]);

  if (phase === 'error') {
    return (
      <main
        className="min-h-screen bg-[#040A16] text-white flex items-center justify-center px-6"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <div className="w-full max-w-md rounded-2xl border border-red-800/60 bg-red-950/30 p-8 text-center">
          <h1 className="text-xl font-bold text-red-300 mb-3">Scan Failed</h1>
          <p className="text-gray-400 text-sm mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate('/race', { replace: true })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Go to Race Hub
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#040A16] text-white flex items-center justify-center"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <p className="text-sm tracking-wide text-blue-200/80">Processing scan…</p>
    </main>
  );
}
