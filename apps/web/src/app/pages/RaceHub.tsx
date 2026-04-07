/* global navigator, HTMLVideoElement, HTMLCanvasElement, MediaStream, ImageBitmapSource */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import jsQR from 'jsqr';
import { Camera, CameraOff, Loader2, Plus, RefreshCcw, Scan, TriangleAlert } from 'lucide-react';

import type { SubmitScanResponse } from '@velocity-gp/api-contract';
import { apiClient, scanEndpoints } from '@/services/api';
import { getSession } from '@/services/auth';
import { trackAnalyticsEvent } from '@/services/observability';
import {
  createPayloadDedupeState,
  mapScanResponseToUiAction,
  resolveScanIdentityForEmail,
  shouldSuppressDuplicatePayload,
  type PayloadDedupeState,
  type ScanFeedback,
  type ScanIdentity,
  type ScannerState,
} from '@/services/scan';
import { useGame } from '../context/GameContext';

interface BarcodeDetectorResult {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

function getBarcodeDetectorConstructor(): BarcodeDetectorConstructor | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

function defaultFeedback(): ScanFeedback {
  return {
    level: 'info',
    title: 'Scanner Idle',
    message: 'Ready when you are. Start the camera to scan a race QR code.',
    canRetry: true,
  };
}

function fallbackGuidanceLines(): string[] {
  return [
    'Open your phone camera app and verify camera access works normally.',
    'Return to Velocity GP and tap Retry Camera Access.',
    'If prompted, allow camera permission for this site in browser settings.',
    'If scanning still fails, try another supported mobile browser/device.',
  ];
}

function feedbackClasses(level: ScanFeedback['level']): string {
  switch (level) {
    case 'success':
      return 'border-green-500/40 bg-green-500/10 text-green-200';
    case 'warning':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
    case 'error':
      return 'border-red-500/40 bg-red-500/10 text-red-200';
    default:
      return 'border-blue-500/30 bg-blue-500/10 text-blue-100';
  }
}

function formatTimestamp(timestamp: Date): string {
  return timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function RaceHub() {
  const { gameState, hydrateScanIdentity, applyScanOutcome } = useGame();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const dedupeRef = useRef<PayloadDedupeState | null>(null);
  const isSubmittingRef = useRef(false);
  // const lastJsQRDecodeTimeRef = useRef<number>(0);
  // const jsQRThrottleIntervalMs = 200; // Throttle jsQR to ~5 fps

  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [feedback, setFeedback] = useState<ScanFeedback>(defaultFeedback());
  const [scanIdentity, setScanIdentity] = useState<ScanIdentity | null>(null);
  const [isHydratingIdentity, setIsHydratingIdentity] = useState(true);
  const [showGuidance, setShowGuidance] = useState(false);

  const scannerActive =
    scannerState === 'requesting_permission' ||
    scannerState === 'ready' ||
    scannerState === 'decoding' ||
    scannerState === 'submitting';

  const stopScanner = useCallback((nextState: ScannerState = 'idle') => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    isSubmittingRef.current = false;
    setScannerState(nextState);
  }, []);

  const applyIdentityResolution = (
    resolution: Awaited<ReturnType<typeof resolveScanIdentityForEmail>>
  ) => {
    if (resolution.status === 'resolved') {
      setScanIdentity(resolution.identity);
      hydrateScanIdentity(resolution.identity);
      setFeedback((current) => {
        if (
          current.title === 'Scan Profile Unavailable' ||
          current.title === 'Scan Profile Missing'
        ) {
          return defaultFeedback();
        }

        return current;
      });
      return;
    }

    setScanIdentity(null);
    setFeedback({
      level: 'warning',
      title: 'Scan Profile Unavailable',
      message: resolution.message,
      canRetry: true,
      showGuidance: true,
    });
  };

  const refreshIdentity = async () => {
    setIsHydratingIdentity(true);

    const session = await getSession();
    const email = gameState.currentUser?.email ?? session.email;
    const resolution = await resolveScanIdentityForEmail(email);

    applyIdentityResolution(resolution);
    setIsHydratingIdentity(false);
  };

  useEffect(() => {
    let isMounted = true;

    async function hydrateIdentity() {
      setIsHydratingIdentity(true);

      const session = await getSession();
      const email = gameState.currentUser?.email ?? session.email;
      const resolution = await resolveScanIdentityForEmail(email);
      if (!isMounted) {
        return;
      }

      applyIdentityResolution(resolution);
      setIsHydratingIdentity(false);
    }

    void hydrateIdentity();

    return () => {
      isMounted = false;
    };
  }, [gameState.currentUser?.email]);

  useEffect(() => {
    return () => {
      stopScanner('idle');
    };
  }, [stopScanner]);

  const detectPayloadFromFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null;
    }

    const Detector = getBarcodeDetectorConstructor();
    if (Detector && detectorRef.current !== false) {
      try {
        if (!detectorRef.current) {
          detectorRef.current = new Detector({ formats: ['qr_code'] });
        }

        const results = await detectorRef.current.detect(video);
        const rawValue = results[0]?.rawValue?.trim();
        if (rawValue) {
          return rawValue;
        }
      } catch {
        trackAnalyticsEvent('scanner_decode_failure', {
          decoder: 'barcode-detector',
        });
        detectorRef.current = false;
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    return qrCode?.data?.trim() || null;
  }, []);

  const submitPayload = useCallback(
    async (payload: string) => {
      if (!scanIdentity) {
        setFeedback({
          level: 'warning',
          title: 'Scan Profile Missing',
          message: 'Cannot submit scan until a player profile is resolved.',
          canRetry: true,
          showGuidance: true,
        });
        setScannerState('error');
        return;
      }

      isSubmittingRef.current = true;
      setScannerState('submitting');

      try {
        const response = await apiClient.post<SubmitScanResponse>(
          scanEndpoints.submitScan(scanIdentity.eventId),
          {
            playerId: scanIdentity.playerId,
            qrPayload: payload,
          }
        );

        if (!response.ok) {
          throw new Error(`scan submission failed (${response.status})`);
        }

        applyScanOutcome(response.data);
        const uiAction = mapScanResponseToUiAction(response.data);
        setFeedback(uiAction.feedback);

        trackAnalyticsEvent('scanner_submit_success', {
          outcome: response.data.outcome,
          error_code: 'errorCode' in response.data ? response.data.errorCode : null,
        });

        if (response.data.outcome === 'BLOCKED') {
          trackAnalyticsEvent('scanner_blocked', {
            error_code: response.data.errorCode,
          });
        }

        if (uiAction.navigateTo) {
          stopScanner('idle');
          navigate(uiAction.navigateTo);
          return;
        }

        if (!uiAction.shouldResumeScanner) {
          stopScanner('idle');
          return;
        }
      } catch {
        trackAnalyticsEvent('scanner_submit_failed', {
          event_id: scanIdentity.eventId,
        });
        setFeedback({
          level: 'error',
          title: 'Submission Failed',
          message: 'Scan submit failed due to a network or API error. Retry when ready.',
          canRetry: true,
          showGuidance: true,
        });
        stopScanner('error');
        return;
      } finally {
        isSubmittingRef.current = false;
      }

      setScannerState('decoding');
    },
    [applyScanOutcome, navigate, scanIdentity, stopScanner]
  );

  const decodeLoop = useCallback(async () => {
    if (!streamRef.current) {
      return;
    }

    try {
      if (!isSubmittingRef.current) {
        const payload = await detectPayloadFromFrame();
        if (payload) {
          if (shouldSuppressDuplicatePayload(payload, Date.now(), dedupeRef.current)) {
            animationFrameRef.current = window.requestAnimationFrame(() => {
              void decodeLoop();
            });
            return;
          }

          dedupeRef.current = createPayloadDedupeState(payload, Date.now());
          trackAnalyticsEvent('scanner_decode_success', {
            payload_length: payload.length,
          });
          void submitPayload(payload);
        }
      }
    } catch {
      trackAnalyticsEvent('scanner_decode_failure', {
        decoder: 'unknown',
      });
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      void decodeLoop();
    });
  }, [detectPayloadFromFrame, submitPayload]);

  const startScanner = useCallback(async () => {
    if (!scanIdentity) {
      setFeedback({
        level: 'warning',
        title: 'Scan Profile Missing',
        message: 'No assigned player profile is available yet. Retry after identity loads.',
        canRetry: true,
        showGuidance: true,
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      trackAnalyticsEvent('scanner_unsupported', {
        reason: 'media_devices_missing',
      });
      setScannerState('unsupported');
      setFeedback({
        level: 'error',
        title: 'Scanner Unsupported',
        message: 'This browser cannot access camera scanning APIs.',
        canRetry: true,
        showGuidance: true,
      });
      return;
    }

    trackAnalyticsEvent('scanner_permission_prompted', {
      event_id: scanIdentity.eventId,
    });
    setScannerState('requesting_permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('video element unavailable');
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      trackAnalyticsEvent('scanner_permission_granted', {
        event_id: scanIdentity.eventId,
      });

      setFeedback({
        level: 'info',
        title: 'Scanner Active',
        message: 'Point your camera at a Velocity GP QR code.',
      });
      dedupeRef.current = null;
      setScannerState('ready');
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setScannerState('decoding');
        void decodeLoop();
      });
    } catch (error) {
      const errorName =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name?: string }).name)
          : 'unknown';

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        trackAnalyticsEvent('scanner_permission_denied', {
          reason: errorName,
        });
        stopScanner('permission_denied');
        setFeedback({
          level: 'error',
          title: 'Camera Permission Denied',
          message: 'Allow camera access to continue scanning from Race Hub.',
          canRetry: true,
          showGuidance: true,
        });
        return;
      }

      stopScanner('error');
      setFeedback({
        level: 'error',
        title: 'Scanner Error',
        message: 'Unable to start camera scanning on this device right now.',
        canRetry: true,
        showGuidance: true,
      });
    }
  }, [decodeLoop, scanIdentity]);

  const guidanceLines = useMemo(() => fallbackGuidanceLines(), []);

  return (
    <div className="min-h-screen bg-black flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="bg-gray-900 border-b border-gray-800 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">{gameState.currentUser?.name ?? 'Player'}</p>
            <h2
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {gameState.currentTeam?.name ?? 'Awaiting Team'}
            </h2>
            {scanIdentity && (
              <p className="text-xs text-gray-500 mt-1">Event: {scanIdentity.eventId}</p>
            )}
          </div>
          <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Rank</p>
            <p className="text-2xl font-bold text-blue-400">
              #{gameState.currentTeam?.rank ?? '—'}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-sm font-medium mb-1">Total Points</p>
          <p
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {(gameState.currentTeam?.score ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="aspect-square rounded-3xl bg-gradient-to-br from-gray-900 to-black border-2 border-gray-800 relative overflow-hidden flex items-center justify-center">
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-500 rounded-br-3xl" />

            <video
              ref={videoRef}
              className={`h-full w-full object-cover ${scannerActive ? 'block' : 'hidden'}`}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {!scannerActive && (
              <div className="w-48 h-48 border-4 border-blue-500 rounded-2xl grid place-items-center">
                {isHydratingIdentity ? (
                  <Loader2 className="w-16 h-16 text-blue-400/70 animate-spin" />
                ) : scannerState === 'permission_denied' ||
                  scannerState === 'unsupported' ||
                  scannerState === 'error' ? (
                  <CameraOff className="w-16 h-16 text-red-400/70" />
                ) : (
                  <Camera className="w-16 h-16 text-blue-400/70" />
                )}
              </div>
            )}

            {scannerState === 'submitting' && (
              <div className="absolute inset-0 bg-black/55 grid place-items-center">
                <div className="flex items-center gap-2 text-blue-200">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting scan...
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-xl border p-3 ${feedbackClasses(feedback.level)}`}>
            <p className="text-sm font-semibold">{feedback.title}</p>
            <p className="text-xs mt-1">{feedback.message}</p>
            {feedback.showGuidance && (
              <button
                type="button"
                onClick={() => setShowGuidance((current) => !current)}
                className="mt-2 text-xs underline underline-offset-2"
              >
                {showGuidance ? 'Hide camera help' : 'Show camera help'}
              </button>
            )}
          </div>

          {showGuidance && (
            <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-3 text-xs text-gray-200">
              <p className="font-semibold mb-2">Camera Recovery Steps</p>
              <ol className="space-y-1 list-decimal pl-4">
                {guidanceLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (scannerActive) {
                  stopScanner('idle');
                  setFeedback(defaultFeedback());
                  return;
                }

                void startScanner();
              }}
              disabled={isHydratingIdentity}
              className="flex-1 py-4 rounded-2xl font-bold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #F97316 100%)',
              }}
            >
              {isHydratingIdentity ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Scan className="w-5 h-5" />
              )}
              {scannerActive
                ? 'Stop Scanner'
                : scannerState === 'idle'
                  ? 'Start Camera Scan'
                  : 'Retry Camera Access'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowGuidance(true);
                stopScanner('idle');
                void refreshIdentity();
              }}
              className="py-4 px-4 rounded-2xl bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
          </div>

          {!scanIdentity && !isHydratingIdentity && (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200 flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              No seeded player profile is mapped for this session email, so scanner submission is
              blocked.
            </div>
          )}
        </div>
      </div>

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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-green-400 font-bold text-lg">
                      {scan.points >= 0 ? '+' : ''}
                      {scan.points}
                    </p>
                    <p className="text-gray-500 text-xs truncate">
                      {scan.outcome} • {scan.message}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 pl-3">
                  {formatTimestamp(scan.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
