import React, { useEffect, useMemo, useState } from 'react';
import type {
  AdminRosterRow,
  GetAdminTeamDetailResponse,
  ListAdminRosterTeamsResponse,
} from '@velocity-gp/api-contract';
import {
  ArrowLeft,
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
  listAdminRoster,
  listAdminRosterTeams,
  updateAdminRosterAssignment,
  updateAdminTeamPitControl,
  updateAdminTeamScore,
} from '@/services/admin/roster';

const UNASSIGNED_OPTION = '__UNASSIGNED__';
const ADMIN_ROSTER_MAX_LIMIT = 200;

function statusBadgeClass(status: 'PENDING' | 'ACTIVE' | 'IN_PIT'): string {
  if (status === 'IN_PIT') {
    return 'bg-[#FF3939]/20 text-[#FF3939] border border-[#FF3939]/30';
  }

  if (status === 'PENDING') {
    return 'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/30';
  }

  return 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30';
}

function formatPitTimer(pitStopExpiresAt: string | null): string {
  if (!pitStopExpiresAt) {
    return 'None';
  }

  const expiresAtMs = Date.parse(pitStopExpiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return 'Invalid';
  }

  const diff = expiresAtMs - Date.now();
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
  const [teamOptions, setTeamOptions] = useState<ListAdminRosterTeamsResponse | null>(null);
  const [rosterRows, setRosterRows] = useState<readonly AdminRosterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);

  const loadTeams = async (overrideEventId?: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const resolvedEventId = overrideEventId ?? eventId ?? (await getCurrentEventId());
      const [nextTeamOptions, nextRoster] = await Promise.all([
        listAdminRosterTeams(resolvedEventId),
        listAdminRoster(resolvedEventId, {
          limit: ADMIN_ROSTER_MAX_LIMIT,
        }),
      ]);

      setEventId(resolvedEventId);
      setTeamOptions(nextTeamOptions);
      setRosterRows(nextRoster.items);
      setAssignmentDrafts({});
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load team roster view.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTeams();
  }, []);

  const teamMembers = useMemo(() => {
    const grouped = new Map<string, AdminRosterRow[]>();
    for (const row of rosterRows) {
      if (!row.teamId) {
        continue;
      }

      const existing = grouped.get(row.teamId) ?? [];
      existing.push(row);
      grouped.set(row.teamId, existing);
    }

    return grouped;
  }, [rosterRows]);

  const unassignedRows = useMemo(
    () => rosterRows.filter((row) => row.assignmentStatus === 'UNASSIGNED'),
    [rosterRows]
  );

  const teams = teamOptions?.teams ?? [];

  async function handleSaveAssignment(playerId: string, existingTeamId: string | null) {
    if (!eventId) {
      return;
    }

    const draftValue = assignmentDrafts[playerId] ?? existingTeamId ?? UNASSIGNED_OPTION;
    const nextTeamId = draftValue === UNASSIGNED_OPTION ? null : draftValue;

    if (nextTeamId === existingTeamId) {
      return;
    }

    setSavingPlayerId(playerId);
    try {
      await updateAdminRosterAssignment(eventId, playerId, nextTeamId);
      await loadTeams(eventId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to save team assignment.');
    } finally {
      setSavingPlayerId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Teams</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadTeams(eventId ?? undefined)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 hover:border-[#00D4FF] text-sm"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading team roster…
        </div>
      ) : (
        <>
          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6">
            <h3 className="font-['Space_Grotesk'] text-lg md:text-xl mb-3">Unassigned Players</h3>
            {unassignedRows.length === 0 ? (
              <p className="text-sm text-gray-400">No unassigned attendees.</p>
            ) : (
              <div className="space-y-2">
                {unassignedRows.map((row) => {
                  const selectedTeamId = assignmentDrafts[row.playerId] ?? UNASSIGNED_OPTION;
                  const isSaving = savingPlayerId === row.playerId;
                  const hasChanges = selectedTeamId !== UNASSIGNED_OPTION;

                  return (
                    <div
                      key={row.playerId}
                      className="rounded-lg border border-gray-800 bg-black/30 p-3 flex flex-col md:flex-row md:items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{row.displayName}</p>
                        <p className="text-xs text-gray-400 font-mono">{row.workEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Assign team for ${row.displayName}`}
                          value={selectedTeamId}
                          onChange={(event) =>
                            setAssignmentDrafts((existing) => ({
                              ...existing,
                              [row.playerId]: event.target.value,
                            }))
                          }
                          className="px-2 py-1 rounded bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
                        >
                          <option value={UNASSIGNED_OPTION}>Unassigned</option>
                          {teams.map((team) => (
                            <option key={team.teamId} value={team.teamId}>
                              {team.teamName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!hasChanges || isSaving}
                          onClick={() => void handleSaveAssignment(row.playerId, row.teamId)}
                          className="px-2 py-1 rounded bg-[#00D4FF] text-black font-semibold disabled:opacity-50"
                        >
                          {isSaving ? 'Saving…' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {teams.map((team) => {
            const members = teamMembers.get(team.teamId) ?? [];
            return (
              <article
                key={team.teamId}
                className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <button
                      type="button"
                      onClick={() => onOpenDetail(team.teamId)}
                      className="font-['Space_Grotesk'] text-lg md:text-xl hover:text-[#00D4FF] text-left"
                    >
                      {team.teamName}
                    </button>
                    <p className="text-xs text-gray-400 font-mono">{team.teamId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono ${statusBadgeClass(team.teamStatus)}`}
                    >
                      {team.teamStatus}
                    </span>
                    <span className="text-sm text-gray-300 inline-flex items-center gap-1">
                      <Users className="w-4 h-4" /> {team.memberCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenDetail(team.teamId)}
                      className="px-2 py-1 rounded border border-gray-700 hover:border-[#00D4FF] text-xs"
                    >
                      Detail
                    </button>
                  </div>
                </div>

                {members.length === 0 ? (
                  <p className="text-sm text-gray-400">No assigned members.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const selectedTeamId =
                        assignmentDrafts[member.playerId] ?? member.teamId ?? UNASSIGNED_OPTION;
                      const isSaving = savingPlayerId === member.playerId;
                      const hasChanges =
                        (selectedTeamId === UNASSIGNED_OPTION ? null : selectedTeamId) !==
                        member.teamId;

                      return (
                        <div
                          key={member.playerId}
                          className="rounded-lg border border-gray-800 bg-black/30 p-3 flex flex-col md:flex-row md:items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{member.displayName}</p>
                            <p className="text-xs text-gray-400 font-mono">{member.workEmail}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Reassign team for ${member.displayName}`}
                              value={selectedTeamId}
                              onChange={(event) =>
                                setAssignmentDrafts((existing) => ({
                                  ...existing,
                                  [member.playerId]: event.target.value,
                                }))
                              }
                              className="px-2 py-1 rounded bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
                            >
                              <option value={UNASSIGNED_OPTION}>Unassigned</option>
                              {teams.map((option) => (
                                <option key={option.teamId} value={option.teamId}>
                                  {option.teamName}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!hasChanges || isSaving}
                              onClick={() =>
                                void handleSaveAssignment(member.playerId, member.teamId)
                              }
                              className="px-2 py-1 rounded bg-[#00D4FF] text-black font-semibold disabled:opacity-50"
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </>
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
        className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"
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
          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">{detail.teamName}</h2>
                <p className="text-xs text-gray-400 font-mono">{detail.teamId}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-mono ${statusBadgeClass(detail.teamStatus)}`}
                >
                  {detail.teamStatus}
                </span>
                <span className="px-2 py-1 rounded border border-gray-700 text-xs text-gray-300">
                  Rank #{detail.rank}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Score</p>
                <p className="text-2xl font-semibold text-[#39FF14]">{detail.score}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Pit Timer</p>
                <p className="text-2xl font-semibold">{formatPitTimer(detail.pitStopExpiresAt)}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Members</p>
                <p className="text-2xl font-semibold">{detail.memberCount}</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 bg-black/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Adjust Score</p>
                {!isEditingScore ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingScore(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-700 hover:border-[#00D4FF] text-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : null}
              </div>

              {isEditingScore ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={scoreDraft}
                    onChange={(event) => setScoreDraft(event.target.value)}
                    className="w-40 px-3 py-2 rounded-lg bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
                  />
                  <button
                    type="button"
                    disabled={isSavingScore}
                    onClick={() => void handleSaveScore()}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded bg-[#00D4FF] text-black font-semibold disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingScore ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingScore}
                    onClick={() => {
                      setScoreDraft(String(detail.score));
                      setIsEditingScore(false);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded border border-gray-700 hover:border-gray-500 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-gray-800 bg-black/30 p-3 space-y-3">
              <p className="font-semibold">Pit Controls</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isUpdatingPit}
                  onClick={() => void handlePitAction('ENTER_PIT')}
                  className="px-3 py-2 rounded bg-[#FACC15] text-black font-semibold disabled:opacity-50"
                >
                  {isUpdatingPit ? 'Updating…' : 'Trigger Pit'}
                </button>
                <button
                  type="button"
                  disabled={isUpdatingPit}
                  onClick={() => void handlePitAction('CLEAR_PIT')}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded bg-[#39FF14] text-black font-semibold disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  Clear Pit
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <button
                type="button"
                disabled={isDeletingTeam}
                onClick={() => void handleDeleteTeam()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-red-600 text-white font-semibold disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingTeam ? 'Deleting…' : 'Delete Team'}
              </button>
            </div>
          </article>

          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6">
            <h3 className="font-['Space_Grotesk'] text-lg md:text-xl mb-3">Ranked Members</h3>
            {detail.members.length === 0 ? (
              <p className="text-sm text-gray-400">No team members are currently assigned.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-gray-300">
                    <tr>
                      <th className="text-left px-3 py-2">Rank</th>
                      <th className="text-left px-3 py-2">Member</th>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.members.map((member) => (
                      <tr key={member.playerId} className="border-t border-gray-800">
                        <td className="px-3 py-2">#{member.rank}</td>
                        <td className="px-3 py-2">{member.displayName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{member.workEmail}</td>
                        <td className="px-3 py-2">{member.individualScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
