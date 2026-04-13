/* global navigator */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Loader2,
  Plus,
  RefreshCcw,
  Scan,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';

import type {
  ListTeamActivityFeedResponse,
  SubmitScanResponse,
  TeamActivityFeedItem,
} from '@velocity-gp/api-contract';
import { apiClient, eventEndpoints, scanEndpoints } from '@/services/api';
import { getSession } from '@/services/auth';
import { trackAnalyticsEvent } from '@/services/observability';
import {
  classifyQrPayload,
  createPayloadDedupeState,
  getTrustedQrRedirectOrigin,
  mapScanResponseToUiAction,
  redirectToTrustedQrUrl,
  resolveScanIdentityForEmail,
  shouldSuppressDuplicatePayload,
  type PayloadDedupeState,
  type ScanFeedback,
  type ScanIdentity,
  type ScannerState,
} from '@/services/scan';
import { useGame } from '../context/GameContext';

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

function getFirstDetectedPayload(detectedCodes: IDetectedBarcode[]): string | null {
  const rawValue = detectedCodes[0]?.rawValue?.trim();
  return rawValue && rawValue.length > 0 ? rawValue : null;
}

function getScannerErrorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name?: string }).name);
  }

  return 'unknown';
}

const TEAM_ACTIVITY_POLL_INTERVAL_MS = 5_000;
const IDENTITY_POLL_INTERVAL_MS = 5_000;
const TEAM_ACTIVITY_LIMIT = 25;

function getActivityIcon(item: TeamActivityFeedItem) {
  if (item.type === 'PLAYER_ONBOARDING_COMPLETED') {
    return <UserPlus className="w-5 h-5 text-blue-300" />;
  }

  if (item.scanOutcome === 'SAFE') {
    return <Plus className="w-5 h-5 text-green-400" />;
  }

  if (item.scanOutcome === 'HAZARD_PIT') {
    return <AlertTriangle className="w-5 h-5 text-red-400" />;
  }

  return <ShieldAlert className="w-5 h-5 text-yellow-300" />;
}

function getActivityIconContainerClasses(item: TeamActivityFeedItem): string {
  if (item.type === 'PLAYER_ONBOARDING_COMPLETED') {
    return 'bg-blue-500/20 border-blue-500/30';
  }

  if (item.scanOutcome === 'SAFE') {
    return 'bg-green-500/20 border-green-500/30';
  }

  if (item.scanOutcome === 'HAZARD_PIT') {
    return 'bg-red-500/20 border-red-500/30';
  }

  return 'bg-yellow-500/20 border-yellow-500/30';
}

function formatActivityHeadline(item: TeamActivityFeedItem): string {
  if (item.type === 'PLAYER_ONBOARDING_COMPLETED') {
    return `${item.playerName} joined the team`;
  }

  const qrLabel = item.qrCodeLabel ?? item.qrPayload;
  if (item.scanOutcome === 'SAFE') {
    return `${item.playerName} scanned ${qrLabel} for +${item.pointsAwarded}`;
  }

  if (item.scanOutcome === 'HAZARD_PIT') {
    return `${item.playerName} triggered a hazard on ${qrLabel}`;
  }

  if (item.scanOutcome === 'INVALID') {
    return `${item.playerName} scanned an invalid QR`;
  }

  if (item.scanOutcome === 'DUPLICATE') {
    return `${item.playerName} re-scanned ${qrLabel}`;
  }

  return `${item.playerName} scan on ${qrLabel} was blocked`;
}

export default function RaceHub() {
  // RaceHub owns scanner lifecycle, scan submission, and feedback mapping for gameplay.
  const { gameState, hydrateScanIdentity, applyScanOutcome } = useGame();
  const navigate = useNavigate();

  const scanIdentityRef = useRef<ScanIdentity | null>(null);
  const hydrateScanIdentityRef = useRef(hydrateScanIdentity);
  const dedupeRef = useRef<PayloadDedupeState | null>(null);
  const isSubmittingRef = useRef(false);
  const scannerEpochRef = useRef<number>(0);
  const teamActivityRequestSeqRef = useRef(0);
  const isRaceHubMountedRef = useRef(true);

  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [feedback, setFeedback] = useState<ScanFeedback>(defaultFeedback());
  const [scanIdentity, setScanIdentity] = useState<ScanIdentity | null>(null);
  const [isHydratingIdentity, setIsHydratingIdentity] = useState(true);
  const [showGuidance, setShowGuidance] = useState(false);
  const [teamActivity, setTeamActivity] = useState<readonly TeamActivityFeedItem[]>([]);
  const [isLoadingTeamActivity, setIsLoadingTeamActivity] = useState(true);
  const [teamActivityLoadError, setTeamActivityLoadError] = useState<string | null>(null);

  const trustedRedirectOrigin = useMemo(() => getTrustedQrRedirectOrigin(), []);
  const scannerActive =
    scannerState === 'requesting_permission' ||
    scannerState === 'ready' ||
    scannerState === 'decoding' ||
    scannerState === 'submitting';

  const stopScanner = useCallback((nextState: ScannerState = 'idle') => {
    isSubmittingRef.current = false;
    scannerEpochRef.current += 1;
    setScannerState(nextState);
  }, []);

  useEffect(() => {
    hydrateScanIdentityRef.current = hydrateScanIdentity;
  }, [hydrateScanIdentity]);

  useEffect(() => {
    return () => {
      isRaceHubMountedRef.current = false;
    };
  }, []);

  const applyIdentityResolution = useCallback(
    (resolution: Awaited<ReturnType<typeof resolveScanIdentityForEmail>>) => {
      if (resolution.status === 'resolved') {
        scanIdentityRef.current = resolution.identity;
        setScanIdentity(resolution.identity);
        hydrateScanIdentityRef.current(resolution.identity);
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

      scanIdentityRef.current = null;
      setScanIdentity(null);
      setFeedback({
        level: 'warning',
        title: 'Scan Profile Unavailable',
        message: resolution.message,
        canRetry: true,
        showGuidance: true,
      });
    },
    []
  );

  const fetchTeamActivity = useCallback(async (identity: ScanIdentity) => {
    const response = await apiClient.get<ListTeamActivityFeedResponse>(
      eventEndpoints.listTeamActivityFeed(identity.eventId, identity.teamId),
      {
        limit: TEAM_ACTIVITY_LIMIT,
      }
    );

    if (!response.ok || !response.data) {
      throw new Error(`activity feed fetch failed (${response.status})`);
    }

    return response.data.items;
  }, []);

  const refreshIdentity = async () => {
    setIsHydratingIdentity(true);

    // Pull latest session/email first so roster assignment updates are reflected immediately.
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
      stopScanner('idle');
    };
  }, [applyIdentityResolution, gameState.currentUser?.email, stopScanner]);

  useEffect(() => {
    let isMounted = true;
    let pollTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    let requestSeq = 0;

    const pollIdentity = async () => {
      const currentRequestSeq = ++requestSeq;
      try {
        const resolution = await resolveScanIdentityForEmail(gameState.currentUser?.email);
        if (!isMounted || currentRequestSeq !== requestSeq || resolution.status !== 'resolved') {
          return;
        }

        applyIdentityResolution(resolution);
      } finally {
        if (isMounted && currentRequestSeq === requestSeq) {
          pollTimeout = globalThis.setTimeout(() => {
            void pollIdentity();
          }, IDENTITY_POLL_INTERVAL_MS);
        }
      }
    };

    pollTimeout = globalThis.setTimeout(() => {
      void pollIdentity();
    }, IDENTITY_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      requestSeq += 1;
      if (pollTimeout) {
        globalThis.clearTimeout(pollTimeout);
      }
    };
  }, [applyIdentityResolution, gameState.currentUser?.email]);

  useEffect(() => {
    if (!gameState.currentTeam?.inPitStop) {
      return;
    }

    stopScanner('idle');
    navigate('/pit-stop', { replace: true });
  }, [gameState.currentTeam?.inPitStop, navigate, stopScanner]);

  useEffect(() => {
    if (!scanIdentity) {
      teamActivityRequestSeqRef.current += 1;
      setTeamActivity([]);
      setIsLoadingTeamActivity(false);
      setTeamActivityLoadError(null);
      return;
    }

    let isMounted = true;
    let pollTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;

    const refreshTeamActivity = async () => {
      const requestSeq = ++teamActivityRequestSeqRef.current;

      try {
        const items = await fetchTeamActivity(scanIdentity);
        if (!isMounted || requestSeq !== teamActivityRequestSeqRef.current) {
          return;
        }

        setTeamActivity(items);
        setTeamActivityLoadError(null);
      } catch {
        if (!isMounted || requestSeq !== teamActivityRequestSeqRef.current) {
          return;
        }

        setTeamActivityLoadError('Unable to load team activity right now.');
      } finally {
        if (isMounted && requestSeq === teamActivityRequestSeqRef.current) {
          setIsLoadingTeamActivity(false);
        }
      }
    };

    const runPollCycle = async () => {
      await refreshTeamActivity();
      if (!isMounted) {
        return;
      }

      pollTimeout = globalThis.setTimeout(() => {
        void runPollCycle();
      }, TEAM_ACTIVITY_POLL_INTERVAL_MS);
    };

    // Reset feed state when identity/team context changes to avoid cross-team stale entries.
    teamActivityRequestSeqRef.current += 1;
    setTeamActivity([]);
    setTeamActivityLoadError(null);
    setIsLoadingTeamActivity(true);
    void runPollCycle();

    return () => {
      isMounted = false;
      if (pollTimeout !== null) {
        globalThis.clearTimeout(pollTimeout);
      }
    };
  }, [fetchTeamActivity, scanIdentity]);

  const submitPayload = useCallback(
    async (payload: string) => {
      const activeScanIdentity = scanIdentityRef.current ?? scanIdentity;
      if (!activeScanIdentity) {
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

      const submitEpoch = scannerEpochRef.current;
      isSubmittingRef.current = true;
      setScannerState('submitting');

      try {
        const response = await apiClient.post<SubmitScanResponse>(
          scanEndpoints.submitScan(activeScanIdentity.eventId),
          {
            playerId: activeScanIdentity.playerId,
            qrPayload: payload,
          }
        );

        if (!response.ok) {
          throw new Error(`scan submission failed (${response.status})`);
        }

        applyScanOutcome(response.data);
        const activityRefreshRequestSeq = ++teamActivityRequestSeqRef.current;
        const activityRefreshEpoch = scannerEpochRef.current;
        const canApplyActivityRefresh = () => {
          const currentIdentity = scanIdentityRef.current;
          return (
            isRaceHubMountedRef.current &&
            activityRefreshRequestSeq === teamActivityRequestSeqRef.current &&
            scannerEpochRef.current === activityRefreshEpoch &&
            currentIdentity?.eventId === activeScanIdentity.eventId &&
            currentIdentity?.teamId === activeScanIdentity.teamId &&
            currentIdentity?.playerId === activeScanIdentity.playerId
          );
        };

        void fetchTeamActivity(activeScanIdentity)
          .then((items) => {
            if (!canApplyActivityRefresh()) {
              return;
            }

            setTeamActivity(items);
            setTeamActivityLoadError(null);
            setIsLoadingTeamActivity(false);
          })
          .catch(() => {
            if (!canApplyActivityRefresh()) {
              return;
            }

            setTeamActivityLoadError('Unable to refresh team activity feed after scan.');
            setIsLoadingTeamActivity(false);
          });

        if (scannerEpochRef.current !== submitEpoch) {
          return;
        }

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
          event_id: activeScanIdentity.eventId,
        });

        if (scannerEpochRef.current !== submitEpoch) {
          return;
        }

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

      if (scannerEpochRef.current !== submitEpoch) {
        return;
      }

      setScannerState('ready');
    },
    [applyScanOutcome, fetchTeamActivity, navigate, scanIdentity, stopScanner]
  );

  const handleDetectedCodes = useCallback(
    (detectedCodes: IDetectedBarcode[]) => {
      if (isSubmittingRef.current) {
        return;
      }

      const payload = getFirstDetectedPayload(detectedCodes);
      if (!payload) {
        return;
      }

      const now = Date.now();
      if (shouldSuppressDuplicatePayload(payload, now, dedupeRef.current)) {
        return;
      }

      dedupeRef.current = createPayloadDedupeState(payload, now);
      trackAnalyticsEvent('scanner_decode_success', {
        payload_length: payload.length,
      });

      const classifiedPayload = classifyQrPayload(payload, trustedRedirectOrigin);
      if (classifiedPayload.kind === 'trusted_url') {
        trackAnalyticsEvent('scanner_redirect_trusted_url', {
          redirect_origin: trustedRedirectOrigin,
        });
        stopScanner('idle');
        redirectToTrustedQrUrl(classifiedPayload.url);
        return;
      }

      if (classifiedPayload.kind === 'untrusted_url') {
        trackAnalyticsEvent('scanner_redirect_blocked', {
          reason: classifiedPayload.reason,
        });
        setFeedback({
          level: 'warning',
          title: 'Untrusted QR URL',
          message: classifiedPayload.message,
          canRetry: true,
        });
        setScannerState('ready');
        return;
      }

      setScannerState('decoding');
      void submitPayload(classifiedPayload.payload);
    },
    [stopScanner, submitPayload, trustedRedirectOrigin]
  );

  const handleScannerError = useCallback(
    (error: unknown) => {
      const errorName = getScannerErrorName(error);

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

      trackAnalyticsEvent('scanner_decode_failure', {
        decoder: 'react-qr-scanner',
        reason: errorName,
      });
      stopScanner('error');
      setFeedback({
        level: 'error',
        title: 'Scanner Error',
        message: 'Unable to start camera scanning on this device right now.',
        canRetry: true,
        showGuidance: true,
      });
    },
    [stopScanner]
  );

  const startScanner = useCallback(async () => {
    const activeScanIdentity = scanIdentityRef.current ?? scanIdentity;
    if (!activeScanIdentity) {
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
      event_id: activeScanIdentity.eventId,
    });
    dedupeRef.current = null;
    setShowGuidance(false);
    setFeedback({
      level: 'info',
      title: 'Scanner Active',
      message: 'Point your camera at a Velocity GP QR code.',
    });
    setScannerState('ready');
  }, [scanIdentity]);

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

            {scannerActive ? (
              <Scanner
                allowMultiple
                scanDelay={250}
                paused={scannerState === 'submitting'}
                formats={['qr_code']}
                constraints={{
                  facingMode: { ideal: 'environment' },
                }}
                onScan={handleDetectedCodes}
                onError={handleScannerError}
                components={{
                  finder: true,
                }}
                classNames={{
                  container: 'h-full w-full',
                  video: 'h-full w-full object-cover',
                }}
              />
            ) : (
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

          <div
            className={`rounded-xl border p-3 ${feedbackClasses(feedback.level)}`}
            role="status"
            aria-live="polite"
          >
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
        </div>
      </div>

      <div className="bg-gray-900 border-t border-gray-800 rounded-t-3xl p-6 max-h-80 overflow-y-auto">
        <h3
          className="text-lg font-bold text-white mb-4"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Recent Activity
        </h3>

        {isLoadingTeamActivity ? (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-gray-700 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 text-sm">Loading team activity...</p>
          </div>
        ) : teamActivity.length === 0 ? (
          <div className="text-center py-8">
            <Scan className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No team activity yet. Start scanning QR codes!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teamActivity.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center p-4 bg-black/50 border border-gray-800 rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 border rounded-lg flex items-center justify-center ${getActivityIconContainerClasses(
                      item
                    )}`}
                  >
                    {getActivityIcon(item)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {formatActivityHeadline(item)}
                    </p>
                    <p className="text-gray-500 text-xs truncate">
                      {item.type === 'PLAYER_QR_SCAN'
                        ? `${item.scanOutcome}${
                            item.scanOutcome === 'SAFE'
                              ? ` • +${item.pointsAwarded} points`
                              : item.errorCode
                                ? ` • ${item.errorCode}`
                                : ''
                          }`
                        : item.summary}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 pl-3">
                  {formatTimestamp(new Date(item.occurredAt))}
                </span>
              </div>
            ))}
          </div>
        )}
        {teamActivityLoadError ? (
          <p className="text-xs text-yellow-300 mt-3">{teamActivityLoadError}</p>
        ) : null}
      </div>
    </div>
  );
}
