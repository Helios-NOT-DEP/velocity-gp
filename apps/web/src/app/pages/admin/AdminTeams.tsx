import React, { useEffect, useMemo, useState } from 'react';
import type { GetAdminTeamDetailResponse } from '@velocity-gp/api-contract';
import {
  ArrowLeft,
  Clock,
  Loader2,
  Pencil,
  RefreshCcw,
  Save,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  deleteAdminTeam,
  getAdminTeamDetail,
  getCurrentEventId,
  listAdminRosterTeams,
  updateAdminTeamPitControl,
  updateAdminTeamScore,
} from '@/services/admin/roster';

interface TeamCard {
  readonly teamId: string;
  readonly teamName: string;
  readonly teamStatus: 'PENDING' | 'ACTIVE' | 'IN_PIT';
  readonly score: number;
  readonly memberCount: number;
  readonly pitStopExpiresAt: string | null;
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) {
    return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black';
  }

  if (rank === 2) {
    return 'bg-gradient-to-br from-gray-300 to-gray-500 text-black';
  }

  if (rank === 3) {
    return 'bg-gradient-to-br from-orange-400 to-orange-600 text-black';
  }

  return 'bg-gray-800 text-gray-400';
}

function statusPillClass(teamStatus: TeamCard['teamStatus']): string {
  if (teamStatus === 'IN_PIT') {
    return 'bg-[#FF3939]/20 text-[#FF3939] border border-[#FF3939]/30';
  }

  if (teamStatus === 'PENDING') {
    return 'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30';
  }

  return 'bg-[#39FF14]/20 text-[#39FF14]';
}

function formatPitTimer(pitStopExpiresAt: string | null, nowMs: number = Date.now()): string {
  if (!pitStopExpiresAt) {
    return 'None';
  }

  const expiresAtMs = Date.parse(pitStopExpiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return 'Invalid';
  }

  const diff = expiresAtMs - nowMs;
  if (diff <= 0) {
    return 'Expired';
  }

  const totalSeconds = Math.floor(diff / 1_000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function TeamListView(props: { onOpenDetail: (teamId: string) => void }) {
  const { onOpenDetail } = props;
  const [eventId, setEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamCards, setTeamCards] = useState<readonly TeamCard[]>([]);

  const loadTeams = async (overrideEventId?: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const resolvedEventId = overrideEventId ?? eventId ?? (await getCurrentEventId());
      const teamOptions = await listAdminRosterTeams(resolvedEventId);

      const detailResults = await Promise.allSettled(
        teamOptions.teams.map((team) => getAdminTeamDetail(resolvedEventId, team.teamId))
      );

      const detailByTeamId = new Map<string, GetAdminTeamDetailResponse>();
      detailResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        const fallbackTeam = teamOptions.teams[index];
        if (!fallbackTeam) {
          return;
        }

        detailByTeamId.set(fallbackTeam.teamId, result.value);
      });

      const cards = teamOptions.teams
        .map((team): TeamCard => {
          const detail = detailByTeamId.get(team.teamId);
          const numericScore =
            detail && typeof detail.score === 'number' && Number.isFinite(detail.score)
              ? detail.score
              : 0;
          const numericMemberCount =
            detail && typeof detail.memberCount === 'number' && Number.isFinite(detail.memberCount)
              ? detail.memberCount
              : team.memberCount;

          return {
            teamId: team.teamId,
            teamName:
              detail && typeof detail.teamName === 'string' && detail.teamName.trim().length > 0
                ? detail.teamName
                : team.teamName,
            teamStatus: detail?.teamStatus ?? team.teamStatus,
            score: numericScore,
            memberCount: numericMemberCount,
            pitStopExpiresAt: detail?.pitStopExpiresAt ?? null,
          };
        })
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          return a.teamName.localeCompare(b.teamName);
        });

      setTeamCards(cards);
      setEventId(resolvedEventId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load team standings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTeams();
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Teams</h2>
        <button
          type="button"
          onClick={() => void loadTeams(eventId ?? undefined)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm hover:border-[#00D4FF] sm:w-auto"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading teams…
        </div>
      ) : teamCards.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No teams registered yet</p>
          <p className="text-sm">Teams will appear here once they register</p>
        </div>
      ) : (
        <div className="space-y-4">
          {teamCards.map((team, index) => {
            const rank = index + 1;

            return (
              <article
                key={team.teamId}
                className={`w-full bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border rounded-xl p-4 md:p-6 hover:border-[#00D4FF] transition-all text-left ${
                  team.teamStatus === 'IN_PIT' ? 'border-[#FF3939]/30' : 'border-gray-800'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-['Space_Grotesk'] font-bold text-lg flex-shrink-0 md:w-12 md:h-12 ${rankBadgeClass(
                        rank
                      )}`}
                    >
                      {rank}
                    </div>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(team.teamId)}
                        aria-label={team.teamName}
                        className="font-['Space_Grotesk'] text-left text-lg font-bold hover:text-[#00D4FF] md:text-xl"
                      >
                        {team.teamName}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-mono ${statusPillClass(team.teamStatus)}`}
                        >
                          {team.teamStatus === 'IN_PIT'
                            ? 'PIT STOP'
                            : team.teamStatus === 'PENDING'
                              ? 'PENDING'
                              : 'RACING'}
                        </span>
                        <span className="text-sm text-gray-400">
                          {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-700/80 bg-black/40 px-3 py-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                    <div className="font-mono text-2xl text-[#39FF14] md:text-3xl">
                      {team.score.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">points</div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(team.teamId)}
                    className="inline-flex items-center rounded-lg border border-[#00D4FF]/40 px-3 py-1.5 text-sm font-semibold text-[#00D4FF] hover:bg-[#00D4FF]/10"
                  >
                    Detail
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeamDetailView(props: { teamId: string; onBack: () => void }) {
  const { teamId, onBack } = props;
  const [eventId, setEventId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GetAdminTeamDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState('0');
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isUpdatingPit, setIsUpdatingPit] = useState(false);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  const [pitTimerNowMs, setPitTimerNowMs] = useState(() => Date.now());

  const sortedMembers = useMemo(() => {
    if (!detail) {
      return [];
    }

    return [...detail.members].sort((a, b) => {
      if (b.individualScore !== a.individualScore) {
        return b.individualScore - a.individualScore;
      }

      return a.displayName.localeCompare(b.displayName);
    });
  }, [detail]);

  const loadDetail = async (overrideEventId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const resolvedEventId = overrideEventId ?? eventId ?? (await getCurrentEventId());
      const response = await getAdminTeamDetail(resolvedEventId, teamId);
      setEventId(resolvedEventId);
      setDetail(response);
      setScoreDraft(String(response.score));
      setIsEditingScore(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load team detail.');
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [teamId]);

  useEffect(() => {
    if (!detail?.pitStopExpiresAt) {
      return;
    }

    const intervalId = globalThis.setInterval(() => {
      setPitTimerNowMs(Date.now());
    }, 1_000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [detail?.pitStopExpiresAt]);

  async function handleSaveScore() {
    if (!eventId || !detail) {
      return;
    }

    const parsed = Number.parseInt(scoreDraft, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Score must be a non-negative integer.');
      return;
    }

    setIsSavingScore(true);
    setError(null);
    try {
      await updateAdminTeamScore(eventId, teamId, {
        score: parsed,
      });
      await loadDetail(eventId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save team score.');
    } finally {
      setIsSavingScore(false);
    }
  }

  async function handlePitAction(action: 'ENTER_PIT' | 'CLEAR_PIT') {
    if (!eventId) {
      return;
    }

    setIsUpdatingPit(true);
    setError(null);
    try {
      await updateAdminTeamPitControl(eventId, teamId, {
        action,
      });
      await loadDetail(eventId);
    } catch (pitError) {
      setError(pitError instanceof Error ? pitError.message : 'Unable to update pit control.');
    } finally {
      setIsUpdatingPit(false);
    }
  }

  async function handleDeleteTeam() {
    if (!eventId) {
      return;
    }

    const confirmed = globalThis.confirm(
      'Delete this team? Members will be unassigned and the team will be hidden from admin lists.'
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingTeam(true);
    setError(null);
    try {
      await deleteAdminTeam(eventId, teamId);
      onBack();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete team.');
      setIsDeletingTeam(false);
    }
  }

  return (
    <section className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </button>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading team detail…
        </div>
      ) : detail ? (
        <>
          <article
            className={`bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border rounded-xl p-4 md:p-6 ${
              detail.teamStatus === 'IN_PIT' ? 'border-[#FF3939]/30' : 'border-gray-800'
            }`}
          >
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div
                  className={`h-14 w-14 rounded-lg flex-shrink-0 flex items-center justify-center font-['Space_Grotesk'] font-bold text-2xl sm:h-16 sm:w-16 ${rankBadgeClass(detail.rank)}`}
                >
                  {detail.rank}
                </div>
                <div className="min-w-0">
                  <h2 className="font-['Space_Grotesk'] text-2xl font-bold break-words md:text-3xl">
                    {detail.teamName}
                  </h2>
                  {detail.keywords.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {detail.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="text-xs px-2 py-0.5 bg-[#00D4FF]/20 text-[#00D4FF] rounded"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-gray-700 bg-black/40 px-4 py-3 text-left sm:text-right lg:min-w-[180px]">
                <div className="font-mono text-3xl text-[#39FF14] sm:text-4xl">
                  {detail.score.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">total points</div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="bg-black/50 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Team Rank</div>
                <div className="font-mono text-2xl text-[#00D4FF]">#{detail.rank}</div>
              </div>
              <div className="bg-black/50 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Members</div>
                <div className="font-mono text-2xl text-white">{detail.memberCount}</div>
              </div>
              <div className="bg-black/50 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className="font-mono text-lg text-white">{detail.teamStatus}</div>
              </div>
              <div className="bg-black/50 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Pit Timer</div>
                <div className="font-mono text-lg text-[#FF3939]">
                  {formatPitTimer(detail.pitStopExpiresAt, pitTimerNowMs)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="bg-black/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Adjust Score</span>
                  {!isEditingScore ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingScore(true)}
                      className="inline-flex items-center gap-1 rounded bg-gray-800 px-2 py-1 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  ) : null}
                </div>

                {isEditingScore ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={0}
                      value={scoreDraft}
                      onChange={(event) => setScoreDraft(event.target.value)}
                      className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded text-white focus:outline-none focus:border-[#00D4FF]"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={isSavingScore}
                        onClick={() => void handleSaveScore()}
                        className="flex-1 py-2 px-3 bg-[#39FF14] text-black rounded hover:opacity-80 transition-all flex items-center justify-center gap-1 font-medium disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingScore(false);
                          setScoreDraft(String(detail.score));
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded bg-gray-800 px-3 py-2 text-white hover:bg-gray-700 transition-all"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void handleDeleteTeam()}
                  disabled={isDeletingTeam}
                  className="w-full py-3 px-4 bg-[#FF3939]/20 text-[#FF3939] rounded-lg hover:bg-[#FF3939]/30 border border-[#FF3939]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>{isDeletingTeam ? 'Deleting Team…' : 'Delete Team'}</span>
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void handlePitAction('ENTER_PIT')}
                  disabled={isUpdatingPit || detail.teamStatus === 'IN_PIT'}
                  className="w-full py-3 px-4 bg-[#FF3939]/20 text-[#FF3939] rounded-lg hover:bg-[#FF3939]/30 border border-[#FF3939]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Clock className="w-5 h-5" />
                  <span>{isUpdatingPit ? 'Triggering Pit…' : 'Trigger Pit'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handlePitAction('CLEAR_PIT')}
                  disabled={isUpdatingPit || detail.teamStatus !== 'IN_PIT'}
                  className="w-full py-3 px-4 bg-[#39FF14]/20 text-[#39FF14] rounded-lg hover:bg-[#39FF14]/30 border border-[#39FF14]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Square className="w-5 h-5" />
                  <span>{isUpdatingPit ? 'Clearing Pit…' : 'Clear Pit'}</span>
                </button>
              </div>
            </div>
          </article>

          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6">
            <h3 className="font-['Space_Grotesk'] text-xl mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00D4FF]" />
              <span>Ranked Members</span>
              <span className="text-base text-gray-400">({sortedMembers.length})</span>
            </h3>
            {sortedMembers.length === 0 ? (
              <p className="text-sm text-gray-400">No team members are currently assigned.</p>
            ) : (
              <div className="space-y-3">
                {sortedMembers.map((member, index) => (
                  <div
                    key={member.playerId}
                    className="bg-black/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center font-['Space_Grotesk'] font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-['DM_Sans'] font-medium truncate">
                          {member.displayName}
                        </div>
                        <div className="text-sm text-gray-400 truncate">{member.workEmail}</div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-mono text-lg text-[#39FF14]">
                        {member.individualScore.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">points</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}

export default function AdminTeams() {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId?: string }>();

  if (teamId) {
    return <TeamDetailView teamId={teamId} onBack={() => navigate('/admin/teams')} />;
  }

  return <TeamListView onOpenDetail={(nextTeamId) => navigate(`/admin/teams/${nextTeamId}`)} />;
}
