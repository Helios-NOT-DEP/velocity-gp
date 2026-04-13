import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, Flag, Radio } from 'lucide-react';

import { useGame, type Team } from '../context/GameContext';
import type {
  DisplayBoardSnapshot,
  DisplayBoardTeam,
  DisplayFallbackTeam,
  DisplayStoryQueueItem,
} from '@/services/display';
import {
  DISPLAY_BOARD_POLL_INTERVAL_MS,
  DISPLAY_BOARD_STALE_AFTER_MS,
  createDisplayBoardSnapshot,
  dequeueNextStoryEvent,
  detectOvertakeStoryEvents,
  enqueueStoryEvents,
  fetchDisplayEvents,
  getDisplayBoardRetryDelayMs,
  mapDisplayEventsToStoryEvents,
  normalizeDisplayBoardFromContextTeams,
  pruneExpiredStoryQueue,
  resolveDisplayBoardSnapshot,
} from '@/services/display';

interface TimedTeamHighlight {
  readonly teamId: string;
  readonly untilMs: number;
}

interface TimedRepairsBanner {
  readonly teamName: string;
  readonly untilMs: number;
}

function mapTeamsToDisplayFallback(teams: readonly Team[]): readonly DisplayFallbackTeam[] {
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    score: team.score,
    rank: team.rank,
    inPitStop: team.inPitStop,
    pitStopExpiresAt: team.pitStopExpiresAt,
    carImage: team.carImage,
  }));
}

function formatClock(nowMs: number): string {
  return new Date(nowMs).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatScore(score: number): string {
  return score.toLocaleString('en-US');
}

function getTeamInitials(teamName: string): string {
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 'VG';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

function hashHue(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }

  return Math.abs(hash);
}

function buildAvatarBackground(teamId: string): React.CSSProperties {
  const hue = hashHue(teamId);
  const secondaryHue = (hue + 65) % 360;

  return {
    backgroundImage: `radial-gradient(circle at 20% 20%, hsl(${hue} 88% 58%), hsl(${secondaryHue} 72% 32%))`,
  };
}

function formatPitCountdown(expiresAtIso: string | null, nowMs: number): string | null {
  if (!expiresAtIso) {
    return null;
  }

  const expiresAtMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAtMs)) {
    return null;
  }

  const secondsRemaining = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildTickerMessage(
  teams: readonly DisplayBoardTeam[],
  nowMs: number,
  activeStoryEvent: DisplayStoryQueueItem | null
): string {
  if (activeStoryEvent) {
    if (activeStoryEvent.type === 'OVERTAKE') {
      return `AI COMMENTARY: ${activeStoryEvent.teamName} surges from P${activeStoryEvent.fromRank} to P${activeStoryEvent.toRank}.`;
    }

    if (activeStoryEvent.type === 'TEAM_ENTERED_PIT') {
      return `AI COMMENTARY: ${activeStoryEvent.teamName} enters pit stop lockout. Countdown is live.`;
    }

    if (activeStoryEvent.type === 'TEAM_EXITED_PIT') {
      return `AI COMMENTARY: ${activeStoryEvent.teamName} exits the pit and rejoins the race.`;
    }

    return `AI COMMENTARY: REPAIRS COMPLETE. ${activeStoryEvent.teamName} is back on track.`;
  }

  if (teams.length === 0) {
    return 'AI COMMENTARY: Waiting for the race grid to populate. Stand by for live standings.';
  }

  const leader = teams[0];
  const chasingTeam = teams[1];
  const pitTeam = teams.find((team) => team.status === 'IN_PIT');

  const fragments = [
    `AI COMMENTARY: ${leader.teamName} leads with ${formatScore(leader.score)} points.`,
    chasingTeam
      ? `${chasingTeam.teamName} is chasing in P${chasingTeam.rank}.`
      : 'The pack is warming up behind the leaders.',
  ];

  if (pitTeam) {
    const pitCountdown = formatPitCountdown(pitTeam.pitStopExpiresAt, nowMs);
    fragments.push(
      pitCountdown
        ? `${pitTeam.teamName} is IN PIT (${pitCountdown} left).`
        : `${pitTeam.teamName} is IN PIT and awaiting release.`
    );
  } else {
    fragments.push('No active pit-stop penalties at this moment.');
  }

  return fragments.join(' ');
}

function TeamAvatar({
  teamId,
  teamName,
  imageUrl,
}: {
  readonly teamId: string;
  readonly teamName: string;
  readonly imageUrl: string | null;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  if (imageUrl && !hasImageError) {
    return (
      <img
        src={imageUrl}
        alt={`${teamName} car`}
        className="h-full w-full object-cover"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={buildAvatarBackground(teamId)}
    >
      <span
        className="text-3xl font-semibold text-white/90"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {getTeamInitials(teamName)}
      </span>
    </div>
  );
}

function TopThreeCard({
  team,
  nowMs,
  highlighted,
}: {
  readonly team: DisplayBoardTeam;
  readonly nowMs: number;
  readonly highlighted: boolean;
}) {
  const pitCountdown = formatPitCountdown(team.pitStopExpiresAt, nowMs);
  const pitLabel = pitCountdown ? `IN PIT (${pitCountdown} left)` : 'IN PIT';
  const statusLabel = team.status === 'IN_PIT' ? pitLabel : team.status;

  return (
    <motion.article
      layout
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      className={`rounded-2xl border p-4 shadow-[0_0_32px_rgba(0,212,255,0.15)] ${
        team.status === 'IN_PIT'
          ? 'border-red-400/70 bg-red-950/35'
          : 'border-cyan-300/30 bg-slate-900/65'
      } ${highlighted ? 'ring-2 ring-emerald-300/80 shadow-[0_0_45px_rgba(52,211,153,0.55)]' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-sm tracking-wide text-cyan-100"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          P{team.rank}
        </span>
        <span className="text-sm text-slate-300">
          {team.memberCount > 0 ? `${team.memberCount} drivers` : ''}
        </span>
      </div>

      <div className="mb-4 h-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900/80">
        <TeamAvatar teamId={team.teamId} teamName={team.teamName} imageUrl={team.carImage} />
      </div>

      <h3 className="truncate text-2xl text-white" style={{ fontFamily: 'var(--font-heading)' }}>
        {team.teamName}
      </h3>
      <motion.p
        key={`${team.teamId}:${team.score}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1 text-4xl text-cyan-200 tabular-nums"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {formatScore(team.score)}
      </motion.p>

      <div className="mt-3 flex items-center gap-2">
        {team.status === 'IN_PIT' ? (
          <>
            <AlertTriangle className="h-4 w-4 text-red-300" />
            <span className="text-sm text-red-200">{statusLabel}</span>
          </>
        ) : (
          <>
            <Flag className="h-4 w-4 text-emerald-300" />
            <span className="text-sm text-emerald-200">{statusLabel}</span>
          </>
        )}
      </div>
    </motion.article>
  );
}

export default function DisplayBoard() {
  const { gameState } = useGame();

  const fallbackTeams = useMemo(
    () => mapTeamsToDisplayFallback(gameState.teams),
    [gameState.teams]
  );

  const fallbackTeamsRef = useRef(fallbackTeams);
  const failureCountRef = useRef(0);
  const displayEventsCursorRef = useRef<string | null>(null);
  const previousSnapshotRef = useRef<DisplayBoardSnapshot | null>(null);

  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [lastApiSuccessAt, setLastApiSuccessAt] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('Connecting to live standings...');
  const [storyFeedDegraded, setStoryFeedDegraded] = useState(false);
  const [storyQueue, setStoryQueue] = useState<readonly DisplayStoryQueueItem[]>([]);
  const [activeStoryEvent, setActiveStoryEvent] = useState<DisplayStoryQueueItem | null>(null);
  const [highlightedTeam, setHighlightedTeam] = useState<TimedTeamHighlight | null>(null);
  const [pitEdgeFlashUntilMs, setPitEdgeFlashUntilMs] = useState(0);
  const [repairsBanner, setRepairsBanner] = useState<TimedRepairsBanner | null>(null);
  const [snapshot, setSnapshot] = useState(() => {
    if (fallbackTeams.length > 0) {
      return createDisplayBoardSnapshot(
        'context',
        normalizeDisplayBoardFromContextTeams(fallbackTeams),
        null
      );
    }

    return createDisplayBoardSnapshot('empty', [], null);
  });

  useEffect(() => {
    fallbackTeamsRef.current = fallbackTeams;
  }, [fallbackTeams]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setStoryQueue((previousQueue) => pruneExpiredStoryQueue(previousQueue, currentTimeMs));

    if (highlightedTeam && highlightedTeam.untilMs <= currentTimeMs) {
      setHighlightedTeam(null);
    }

    if (repairsBanner && repairsBanner.untilMs <= currentTimeMs) {
      setRepairsBanner(null);
    }
  }, [currentTimeMs, highlightedTeam, repairsBanner]);

  useEffect(() => {
    if (activeStoryEvent || storyQueue.length === 0) {
      return;
    }

    const { nextEvent, remainingQueue } = dequeueNextStoryEvent(storyQueue, Date.now());
    if (!nextEvent) {
      if (remainingQueue.length !== storyQueue.length) {
        setStoryQueue(remainingQueue);
      }
      return;
    }

    setStoryQueue(remainingQueue);
    setActiveStoryEvent(nextEvent);
  }, [activeStoryEvent, storyQueue]);

  useEffect(() => {
    if (!activeStoryEvent) {
      return;
    }

    const startedAt = Date.now();

    if (activeStoryEvent.type === 'OVERTAKE') {
      setHighlightedTeam({
        teamId: activeStoryEvent.teamId,
        untilMs: startedAt + activeStoryEvent.ttlMs,
      });
    }

    if (activeStoryEvent.type === 'TEAM_ENTERED_PIT') {
      setPitEdgeFlashUntilMs(startedAt + activeStoryEvent.ttlMs);
    }

    if (activeStoryEvent.type === 'TEAM_REPAIRS_COMPLETE') {
      setRepairsBanner({
        teamName: activeStoryEvent.teamName,
        untilMs: startedAt + activeStoryEvent.ttlMs,
      });
    }

    const timeoutId = window.setTimeout(() => {
      setActiveStoryEvent(null);
    }, activeStoryEvent.ttlMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeStoryEvent]);

  const refreshSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await resolveDisplayBoardSnapshot(fallbackTeamsRef.current);
      setSnapshot(nextSnapshot);

      const previousSnapshot = previousSnapshotRef.current;
      const eventChanged =
        previousSnapshot?.source === 'api'
          ? previousSnapshot.eventId !== nextSnapshot.eventId
          : nextSnapshot.source === 'api' && Boolean(nextSnapshot.eventId);
      const nowMs = Date.now();
      const overtakeEvents = detectOvertakeStoryEvents(previousSnapshot, nextSnapshot);

      if (eventChanged) {
        displayEventsCursorRef.current = null;
        setStoryQueue([]);
        setActiveStoryEvent(null);
        setHighlightedTeam(null);
        setPitEdgeFlashUntilMs(0);
        setRepairsBanner(null);
      }

      previousSnapshotRef.current = nextSnapshot;

      let storyEventsFetchFailed = false;
      let displayEventsStory = [] as ReturnType<typeof mapDisplayEventsToStoryEvents>;

      if (nextSnapshot.source === 'api' && nextSnapshot.eventId) {
        const displayEventsResult = await fetchDisplayEvents(
          nextSnapshot.eventId,
          displayEventsCursorRef.current
        );

        if (displayEventsResult) {
          displayEventsCursorRef.current = displayEventsResult.nextCursor;
          displayEventsStory = mapDisplayEventsToStoryEvents(displayEventsResult.items);
          setStoryFeedDegraded(false);
        } else {
          storyEventsFetchFailed = true;
          setStoryFeedDegraded(true);
        }
      } else {
        setStoryFeedDegraded(false);
      }

      const incomingStoryEvents = [...overtakeEvents, ...displayEventsStory];
      if (incomingStoryEvents.length > 0) {
        setStoryQueue((previousQueue) =>
          enqueueStoryEvents(previousQueue, incomingStoryEvents, nowMs)
        );
      }

      if (nextSnapshot.source === 'api') {
        failureCountRef.current = 0;
        setLastApiSuccessAt(nextSnapshot.fetchedAt);
        setStatusMessage(
          storyEventsFetchFailed
            ? 'Live standings feed connected. Story feed unavailable; showing scoreboard-only updates.'
            : 'Live standings and story feeds connected.'
        );
        return DISPLAY_BOARD_POLL_INTERVAL_MS;
      }

      failureCountRef.current += 1;
      if (nextSnapshot.source === 'context') {
        setStatusMessage('Live feed unavailable. Showing local fallback standings.');
      } else {
        setStatusMessage('Waiting for teams to enter the race.');
      }

      return getDisplayBoardRetryDelayMs(failureCountRef.current);
    } catch {
      failureCountRef.current += 1;
      setStatusMessage('Temporary feed interruption. Retrying...');
      return getDisplayBoardRetryDelayMs(failureCountRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      const nextDelayMs = await refreshSnapshot();
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void poll();
      }, nextDelayMs);
    };

    void poll();

    return () => {
      cancelled = true;
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [refreshSnapshot]);

  const liveTickerMessage = useMemo(
    () => buildTickerMessage(snapshot.teams, currentTimeMs, activeStoryEvent),
    [activeStoryEvent, currentTimeMs, snapshot.teams]
  );

  const stale =
    snapshot.source !== 'api' ||
    currentTimeMs - (lastApiSuccessAt ?? 0) > DISPLAY_BOARD_STALE_AFTER_MS;

  const isPitEdgeFlashActive = currentTimeMs < pitEdgeFlashUntilMs;
  const isRepairsBannerActive = Boolean(repairsBanner && currentTimeMs < repairsBanner.untilMs);

  return (
    <div
      className="min-h-screen overflow-hidden text-white"
      style={{
        fontFamily: 'var(--font-body)',
        backgroundColor: '#050E1D',
        backgroundImage:
          'radial-gradient(circle at 20% -10%, rgba(0,212,255,0.16), transparent 45%), radial-gradient(circle at 80% -20%, rgba(57,255,20,0.1), transparent 55%), linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
        backgroundSize: 'auto, auto, 36px 36px, 36px 36px',
      }}
    >
      {isPitEdgeFlashActive && (
        <motion.div
          aria-label="Pit entry alert"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: [0.9, 0.25, 0.75, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="pointer-events-none fixed inset-0 z-50 border-[10px] border-red-500"
        />
      )}

      {isRepairsBannerActive && repairsBanner && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-xl border border-emerald-300/70 bg-emerald-950/85 px-6 py-3 text-center shadow-[0_0_40px_rgba(52,211,153,0.45)]"
        >
          <p className="text-xs tracking-[0.2em] text-emerald-200">REPAIRS COMPLETE</p>
          <p className="text-lg text-white" style={{ fontFamily: 'var(--font-heading)' }}>
            {repairsBanner.teamName} is back on track.
          </p>
        </motion.div>
      )}

      <header className="border-b border-cyan-400/25 bg-slate-950/75 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">Velocity GP</p>
            <h1 className="text-3xl text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              Main Stage Display Board
            </h1>
          </div>
          <div className="text-right">
            <div className="mb-1 flex items-center justify-end gap-2">
              <Radio className={`h-4 w-4 ${stale ? 'text-amber-300' : 'text-emerald-300'}`} />
              <span className={`text-sm ${stale ? 'text-amber-200' : 'text-emerald-200'}`}>
                {stale ? 'DEGRADED' : 'LIVE'}
              </span>
            </div>
            <p
              className="text-4xl tabular-nums text-cyan-100"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {formatClock(currentTimeMs)}
            </p>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-[1440px] text-sm text-slate-300">
          {statusMessage}
          {storyFeedDegraded ? ' (story events are temporarily degraded)' : ''}
        </p>
      </header>

      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-6 pb-28 pt-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section aria-label="Top 3 Teams" className="space-y-4">
          <h2 className="text-lg uppercase tracking-[0.16em] text-cyan-100/90">Top 3 Teams</h2>
          {snapshot.topThree.length > 0 ? (
            snapshot.topThree.map((team) => {
              const isHighlighted =
                highlightedTeam?.teamId === team.teamId && currentTimeMs < highlightedTeam.untilMs;

              return (
                <TopThreeCard
                  key={team.teamId}
                  team={team}
                  nowMs={currentTimeMs}
                  highlighted={Boolean(isHighlighted)}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-cyan-200/20 bg-slate-900/55 p-6 text-slate-300">
              Standings will appear here once teams start scoring.
            </div>
          )}
        </section>

        <section
          aria-label="Leaderboard Grid"
          className="rounded-2xl border border-cyan-300/20 bg-slate-950/65 p-4"
        >
          <h2 className="mb-4 text-lg uppercase tracking-[0.16em] text-cyan-100/90">The Grid</h2>
          <div className="grid grid-cols-[64px_1fr_180px_220px] border-b border-slate-700/70 px-3 pb-2 text-sm uppercase tracking-wide text-slate-400">
            <span>Rank</span>
            <span>Team</span>
            <span className="text-right">Score</span>
            <span className="text-right">Status</span>
          </div>

          <div className="mt-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {snapshot.grid.length === 0 ? (
              <div className="px-3 py-8 text-slate-400">
                Grid positions 4-15 will populate as teams score.
              </div>
            ) : (
              snapshot.grid.map((team) => {
                const pitCountdown = formatPitCountdown(team.pitStopExpiresAt, currentTimeMs);
                const pitLabel = pitCountdown ? `IN PIT (${pitCountdown} left)` : 'IN PIT';
                const statusLabel = team.status === 'IN_PIT' ? pitLabel : team.status;
                const isHighlighted =
                  highlightedTeam?.teamId === team.teamId &&
                  currentTimeMs < highlightedTeam.untilMs;

                return (
                  <motion.div
                    layout
                    transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                    key={team.teamId}
                    data-team-id={team.teamId}
                    className={`mt-2 grid grid-cols-[64px_1fr_180px_220px] items-center rounded-xl border px-3 py-3 ${
                      team.status === 'IN_PIT'
                        ? 'border-red-400/60 bg-red-950/35'
                        : 'border-slate-700/80 bg-slate-900/70'
                    } ${isHighlighted ? 'ring-2 ring-emerald-300/80 bg-emerald-900/20' : ''}`}
                  >
                    <span
                      className="text-xl tabular-nums text-slate-100"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {team.rank}
                    </span>
                    <span
                      className="truncate text-xl text-white"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {team.teamName}
                    </span>
                    <motion.span
                      key={`${team.teamId}:${team.score}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-right text-2xl tabular-nums text-cyan-100"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {formatScore(team.score)}
                    </motion.span>
                    <span
                      className={`text-right text-sm ${
                        team.status === 'IN_PIT'
                          ? 'text-red-200'
                          : team.status === 'PENDING'
                            ? 'text-amber-200'
                            : 'text-emerald-200'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>
      </main>

      <div
        aria-label="Live commentary ticker"
        className="fixed bottom-0 left-0 right-0 border-t border-cyan-400/25 bg-slate-950/90"
      >
        <div className="flex items-center gap-4 overflow-hidden px-4 py-3">
          <div className="flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-cyan-100">
            <Activity className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">AI Commentary</span>
          </div>
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="whitespace-nowrap text-base text-cyan-100/90"
          >
            {liveTickerMessage} {' • '} {liveTickerMessage} {' • '} {liveTickerMessage}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
