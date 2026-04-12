import React, { useEffect, useMemo, useState } from 'react';
import type { AdminRosterRow, ListAdminRosterTeamsResponse } from '@velocity-gp/api-contract';
import { Loader2, RefreshCcw, Users } from 'lucide-react';
import {
  getCurrentEventId,
  listAdminRoster,
  listAdminRosterTeams,
  updateAdminRosterAssignment,
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

export default function AdminTeams() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [teamOptions, setTeamOptions] = useState<ListAdminRosterTeamsResponse | null>(null);
  const [rosterRows, setRosterRows] = useState<readonly AdminRosterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  // TODO(figma-sync): Add team detail interactions (score edits, pit-stop controls, member ranking view) that exist in Figma Admin but are not present in this assignment-focused page. | Figma source: src/app/pages/Admin.tsx Teams tab + team detail view | Impact: admin flow

  const loadTeams = async (overrideEventId?: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      // Keep team summary + roster rows in sync by loading both from the same event snapshot.
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
    // Build a quick team->members lookup map for table rendering.
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
            // TODO(figma-sync): Introduce selectable team drill-down state to mirror the Figma Admin team detail transition from list card to full team panel. | Figma source: src/app/pages/Admin.tsx selectedTeamId workflow | Impact: admin flow
            return (
              <article
                key={team.teamId}
                className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-['Space_Grotesk'] text-lg md:text-xl">{team.teamName}</h3>
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
