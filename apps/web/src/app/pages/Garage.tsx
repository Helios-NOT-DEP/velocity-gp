/**
 * Garage Page
 *
 * The first screen every player sees after they log in via their unique team link.
 * Drives the full team-onboarding experience through a state machine:
 *
 *   INPUT        → Player types their self-description
 *   SUBMITTING   → POST /garage/submit in-flight
 *   REJECTED     → Moderation blocked the text; player must revise and retry
 *   WAITING      → Player approved; polling until all teammates also submit
 *   GENERATING   → Quota met; n8n logo generation in-flight; polling for READY
 *   LOGO_REVEAL  → Logo ready; show the team identity and the "Enter Race Hub" button
 *   ERROR        → Unexpected network or server error; allows retry
 *
 * On mount the page immediately fetches team status so that:
 *   - A player who refreshes after submitting lands in WAITING/GENERATING/LOGO_REVEAL
 *     without having to resubmit.
 *   - A player who joins after all others went through sees LOGO_REVEAL straight away.
 *
 * Service calls are isolated in garageService.ts — this component contains
 * no raw fetch() calls.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Info, Loader2, ShieldAlert, Sparkles, Users } from 'lucide-react';

import type { TeamGarageStatus } from '@/services/garage/garageService';
import { garageService } from '@/services/garage/garageService';
import { usePlayerSession } from '@/hooks';

// ── UI state machine ──────────────────────────────────────────────────────────

/**
 * The component is always in exactly one of these states.
 * Type-narrowing at each render branch ensures each state only shows its
 * relevant data (no "which fields might be undefined?" guesswork).
 */
type GarageUIState =
  | { screen: 'LOADING' } // initial status fetch
  | { screen: 'INPUT' } // player composing description
  | { screen: 'SUBMITTING' } // POST in-flight
  | { screen: 'REJECTED'; policyMessage: string } // moderation blocked
  | { screen: 'WAITING'; teamStatus: TeamGarageStatus } // submitted; others pending
  | { screen: 'GENERATING'; teamStatus: TeamGarageStatus } // quota met; n8n in-flight
  | { screen: 'LOGO_FAILED'; teamStatus: TeamGarageStatus } // logo generation failed; retry available
  | { screen: 'LOGO_REVEAL'; teamStatus: TeamGarageStatus } // logo ready
  | { screen: 'ERROR'; message: string }; // network / 5xx failure

// How often to poll the status endpoint while waiting or generating (ms)
const POLL_INTERVAL_MS = 4_000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Garage() {
  // TODO(figma-sync): Replace keyword-based generation with description-driven onboarding to match the updated Team Onboarding design flow. | Figma source: src/app/pages/Garage.tsx description textarea + suggestion chips | Impact: user flow
  const navigate = useNavigate();
  // Read playerId / teamId / eventId from localStorage (written by savePlayerSession
  // after a successful magic-link login).  Falls back to seeded dev values so the
  // Garage page is fully usable during local development without going through login.
  const { player, isReady } = usePlayerSession();
  const { playerId, teamId, eventId } = player;

  const [description, setDescription] = useState('');
  const [uiState, setUiState] = useState<GarageUIState>({ screen: 'LOADING' });

  // We keep a ref to the poll interval so we can clear it when the component
  // unmounts or when we no longer need to poll (avoids memory leak / ghost calls)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mount: load current team status ─────────────────────────────────────────
  // Wait for usePlayerSession to finish reading localStorage before fetching;
  // avoids firing the status call with dev-fallback IDs when a real session exists.
  useEffect(() => {
    if (!isReady) return; // session not yet loaded — skip until it resolves
    let cancelled = false;

    async function loadInitialStatus() {
      try {
        const status = await garageService.getTeamStatus(teamId, playerId);
        if (cancelled) return;

        // Restore the correct screen based on what we find in the DB
        setUiState(deriveScreenFromStatus(status));
      } catch {
        if (!cancelled) {
          // If the initial load fails, fall through to the INPUT screen so the
          // player can still try to submit (graceful degradation)
          setUiState({ screen: 'INPUT' });
        }
      }
    }

    void loadInitialStatus();
    return () => {
      cancelled = true;
    };
  }, [teamId, playerId, isReady]);

  // ── Polling: WAITING, GENERATING, LOGO_FAILED, and LOGO_REVEAL screens ────────────────────
  useEffect(() => {
    const shouldPoll =
      uiState.screen === 'WAITING' ||
      uiState.screen === 'GENERATING' ||
      uiState.screen === 'LOGO_FAILED' ||
      // Keep polling on LOGO_REVEAL so existing members see the updated logo if a
      // late-joining teammate triggers a re-generation (READY → GENERATING → READY).
      uiState.screen === 'LOGO_REVEAL';

    if (!shouldPoll) {
      // Clear any running interval when we leave a polling state
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // Start polling
    pollRef.current = setInterval(async () => {
      try {
        const status = await garageService.getTeamStatus(teamId, playerId);
        const next = deriveScreenFromStatus(status);

        // Only update state if something meaningful changed (avoids unnecessary
        // re-renders when the status hasn't moved)
        setUiState((prev) => {
          if (prev.screen === next.screen) {
            // Screen hasn't changed, but check if teamStatus changed
            // (e.g., approvedCount, requiredCount, logoStatus, logoUrl)
            if (
              'teamStatus' in prev &&
              'teamStatus' in next &&
              (prev.teamStatus.approvedCount !== next.teamStatus.approvedCount ||
                prev.teamStatus.requiredCount !== next.teamStatus.requiredCount ||
                prev.teamStatus.logoStatus !== next.teamStatus.logoStatus ||
                prev.teamStatus.logoUrl !== next.teamStatus.logoUrl)
            ) {
              return next;
            }
            return prev;
          }
          return next;
        });
      } catch {
        // Swallow poll errors silently — a single failed poll shouldn't kick
        // the player out of the waiting state.  The interval will retry.
      }
    }, POLL_INTERVAL_MS);

    // Clean up when effect re-runs or component unmounts
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [uiState.screen, teamId, playerId]);

  // ── Submit handler ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!description.trim()) return;

    setUiState({ screen: 'SUBMITTING' });

    try {
      const result = await garageService.submit({
        playerId,
        teamId,
        eventId,
        description: description.trim(),
      });

      if (result.status === 'rejected') {
        // Content policy violation — show the user-facing message
        setUiState({
          screen: 'REJECTED',
          policyMessage:
            result.policyMessage ??
            'Your description could not be accepted. Please revise it and try again.',
        });
        return;
      }

      // Approved — transition to whichever screen the team is now in
      setUiState(deriveScreenFromStatus(result.teamGarageStatus));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setUiState({ screen: 'ERROR', message });
    }
  }

  // ── Render branches ───────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-black flex items-center justify-center p-6"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Full-screen gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E3B] via-black to-[#050E1D] opacity-50" />

      <div className="relative z-10 w-full max-w-2xl">
        {/* ── LOADING ── */}
        {uiState.screen === 'LOADING' && (
          <CenteredMessage>
            <Loader2 className="w-10 h-10 animate-spin text-[#00D4FF] mx-auto mb-4" />
            <p className="text-gray-400">Loading your team status…</p>
          </CenteredMessage>
        )}

        {/* ── INPUT / REJECTED / LOGO_FAILED - description form ── */}
        {(uiState.screen === 'INPUT' ||
          uiState.screen === 'REJECTED' ||
          uiState.screen === 'LOGO_FAILED' ||
          uiState.screen === 'ERROR') && (
          <>
            {/* Header */}
            <PageHeader subtitle="You're about to join the race. Let's get to know you better." />

            {/* Main card */}
            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl">
              {/* Policy rejection banner */}
              {uiState.screen === 'REJECTED' && (
                <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-semibold mb-1">
                      Description not accepted
                    </p>
                    <p className="text-sm text-red-400">{uiState.policyMessage}</p>
                  </div>
                </div>
              )}

              {/* Logo generation failure banner */}
              {uiState.screen === 'LOGO_FAILED' && (
                <div className="bg-orange-900/20 border border-orange-500/40 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-orange-300 font-semibold mb-1">
                      Logo generation failed
                    </p>
                    <p className="text-sm text-orange-400">
                      We couldn't create your team logo. Please try resubmitting your description.
                    </p>
                  </div>
                </div>
              )}

              {/* Generic error banner */}
              {uiState.screen === 'ERROR' && (
                <div className="bg-orange-900/20 border border-orange-500/40 rounded-xl p-4 mb-6">
                  <p className="text-sm text-orange-300">{uiState.message}</p>
                </div>
              )}

              {/* Info callout */}
              <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-xl p-4 mb-8 flex items-start gap-3">
                <Info className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#00D4FF] font-['DM_Sans']">
                  {uiState.screen === 'LOGO_FAILED'
                    ? 'Your team logo generation ran into an issue. Resubmitting your description may help resolve it.'
                    : "Your description will be combined with your teammates' to generate a unique team logo using AI."}
                </p>
              </div>

              {/* Textarea */}
              <div className="mb-8">
                <label className="block text-white font-['Space_Grotesk'] text-xl mb-3">
                  {uiState.screen === 'LOGO_FAILED'
                    ? 'Retry your description'
                    : 'Describe yourself in a few words'}
                </label>
                <p className="text-gray-400 text-sm mb-4 font-['DM_Sans']">
                  Tell us what makes you unique — your style, values, or personality.
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Fast, innovative, bold, creative, determined…"
                  rows={4}
                  maxLength={200}
                  className="w-full px-5 py-4 bg-black border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/20 transition-all resize-none font-['DM_Sans']"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500 font-['DM_Sans']">3–200 characters</p>
                  <span className="text-xs text-gray-500 font-mono">{description.length}/200</span>
                </div>
              </div>

              {/* Quick-pick chips */}
              <div className="mb-8">
                <p className="text-sm text-gray-400 mb-3 font-['DM_Sans']">Popular choices:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTION_CHIPS.map((word) => (
                    <button
                      key={word}
                      onClick={() => {
                        if (description.length + word.length + 2 <= 200) {
                          setDescription((prev) => (prev ? `${prev}, ${word}` : word));
                        }
                      }}
                      className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-gray-300 hover:text-white text-sm transition-all font-['DM_Sans']"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={description.trim().length < 3}
                className="w-full py-5 rounded-xl font-bold text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-['Space_Grotesk'] text-lg"
                style={{
                  background:
                    description.trim().length >= 3
                      ? 'linear-gradient(135deg, #00D4FF 0%, #F97316 100%)'
                      : '#1F2937',
                }}
              >
                <Sparkles className="w-6 h-6" />
                {uiState.screen === 'LOGO_FAILED' ? 'Retry Generation' : 'Submit Description'}
              </button>
            </div>

            <p className="text-center text-gray-500 text-sm mt-6 font-['DM_Sans']">
              Your team logo will be generated once everyone has submitted.
            </p>
          </>
        )}

        {/* ── SUBMITTING ── */}
        {uiState.screen === 'SUBMITTING' && (
          <CenteredMessage>
            <Loader2 className="w-10 h-10 animate-spin text-[#00D4FF] mx-auto mb-4" />
            <p className="text-white font-semibold text-lg mb-1">Checking your description…</p>
            <p className="text-gray-400 text-sm">Running content moderation</p>
          </CenteredMessage>
        )}

        {/* ── WAITING ── */}
        {uiState.screen === 'WAITING' && (
          <>
            <PageHeader subtitle="Your description is in. Waiting for teammates to submit theirs." />

            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl text-center">
              {/* Animated pulsing orb */}
              <div className="relative inline-flex items-center justify-center mb-8">
                <div className="absolute w-24 h-24 rounded-full bg-[#00D4FF]/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-[#00D4FF]/30 flex items-center justify-center">
                  <Users className="w-8 h-8 text-[#00D4FF]" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mb-2">
                Waiting for teammates
              </h2>
              <p className="text-gray-400 font-['DM_Sans'] mb-8">
                {uiState.teamStatus.approvedCount} of {uiState.teamStatus.requiredCount}{' '}
                descriptions submitted
              </p>

              {/* Progress bar */}
              <ProgressBar
                value={uiState.teamStatus.approvedCount}
                max={uiState.teamStatus.requiredCount}
              />

              <p className="text-gray-500 text-sm mt-6 font-['DM_Sans']">
                This page refreshes automatically — no need to reload.
              </p>
            </div>
          </>
        )}

        {/* ── GENERATING ── */}
        {uiState.screen === 'GENERATING' && (
          <>
            <PageHeader subtitle="All descriptions collected. Creating your team's logo…" />

            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl text-center">
              {/* Sparkle animation */}
              <div className="relative inline-flex items-center justify-center mb-8">
                <div className="absolute w-24 h-24 rounded-full bg-[#F97316]/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-[#F97316]/30 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[#F97316]" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mb-2">
                Generating your team identity
              </h2>
              <p className="text-gray-400 font-['DM_Sans'] mb-2">
                AI is crafting a unique logo for{' '}
                <span className="text-[#F97316] font-semibold">{uiState.teamStatus.teamName}</span>
              </p>
              <p className="text-gray-500 text-sm font-['DM_Sans']">
                This usually takes 10–20 seconds…
              </p>

              {/* Animated dots */}
              <div className="flex justify-center gap-2 mt-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full bg-[#F97316]"
                    style={{ animation: `bounce 1s ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── LOGO_REVEAL ── */}
        {uiState.screen === 'LOGO_REVEAL' && (
          <>
            <PageHeader subtitle="Your team identity is ready. Let's race!" />

            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-2xl p-8 md:p-12 shadow-2xl text-center">
              {/* Team name */}
              <h2
                className="text-4xl font-bold mb-6 font-['Space_Grotesk']"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF 0%, #F97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {uiState.teamStatus.teamName}
              </h2>

              {/* Generated logo */}
              {uiState.teamStatus.logoUrl ? (
                <div className="inline-block mb-8 rounded-2xl overflow-hidden border-2 border-[#00D4FF]/30 shadow-[0_0_40px_rgba(0,212,255,0.15)]">
                  <img
                    src={uiState.teamStatus.logoUrl}
                    alt={`${uiState.teamStatus.teamName} team logo`}
                    className="w-64 h-64 object-cover"
                  />
                </div>
              ) : (
                /* Fallback placeholder if logoUrl is somehow missing */
                <div className="w-64 h-64 mx-auto mb-8 rounded-2xl bg-gray-800 flex items-center justify-center border border-gray-700">
                  <Users className="w-24 h-24 text-gray-600" />
                </div>
              )}

              <p className="text-gray-400 font-['DM_Sans'] mb-8">Your team's identity is ready.</p>

              {/* Enter Race Hub CTA */}
              <button
                onClick={() => navigate('/race-hub')}
                className="w-full py-5 rounded-xl font-bold text-white flex items-center justify-center gap-3 font-['Space_Grotesk'] text-lg hover:opacity-90 transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF 0%, #F97316 100%)',
                }}
              >
                Enter Race Hub
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helper: map TeamGarageStatus → GarageUIState ─────────────────────────────

/**
 * Given the server's current team snapshot, returns the appropriate UI state.
 * Called both on mount (to restore screen after refresh) and after submit.
 */
function deriveScreenFromStatus(status: TeamGarageStatus): GarageUIState {
  // Logo is done — reveal it regardless of who just submitted
  if (status.logoStatus === 'READY') {
    return { screen: 'LOGO_REVEAL', teamStatus: status };
  }

  // n8n is in-flight — show the generating animation (only if actually generating)
  if (status.logoStatus === 'GENERATING') {
    return { screen: 'GENERATING', teamStatus: status };
  }

  // Generation failed — show dedicated FAILED UI with retry CTA.
  // Player can resubmit to trigger retry; no perpetual waiting required.
  // This appears whenever quota is met and generation failed, regardless of other players.
  if (status.logoStatus === 'FAILED' && status.approvedCount >= status.requiredCount) {
    return { screen: 'LOGO_FAILED', teamStatus: status };
  }

  // This player hasn't submitted yet (or was rejected and needs to retry)
  if (!status.mySubmission.submitted || status.mySubmission.status === 'REJECTED') {
    return { screen: 'INPUT' };
  }

  // Player has an approved submission; waiting for others or for generation to finish
  return { screen: 'WAITING', teamStatus: status };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00D4FF]/20 to-[#F97316]/20 border border-[#00D4FF]/30 rounded-full mb-6">
        <Users className="w-5 h-5 text-[#00D4FF]" />
        <span className="font-['DM_Sans'] font-medium text-[#00D4FF]">Team Onboarding</span>
      </div>
      <h1
        className="text-5xl md:text-6xl font-bold mb-4"
        style={{
          fontFamily: 'var(--font-heading)',
          background: 'linear-gradient(135deg, #00D4FF 0%, #F97316 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Welcome to the Garage
      </h1>
      <p className="text-gray-400 text-lg max-w-xl mx-auto font-['DM_Sans']">{subtitle}</p>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-2xl p-12 shadow-2xl text-center">
      {children}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #00D4FF, #F97316)',
        }}
      />
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  'Fast',
  'Bold',
  'Innovative',
  'Dynamic',
  'Fierce',
  'Unstoppable',
  'Creative',
  'Strategic',
];
