import React, { useEffect, useMemo, useState } from 'react';
import type {
  AdminPlayerScanHistoryItem,
  ListAdminRosterQuery,
  ListAdminRosterResponse,
  ListAdminRosterTeamsResponse,
  RosterImportApplyResponse,
  RosterImportPreviewResponse,
  RosterImportRowInput,
} from '@velocity-gp/api-contract';
import { ArrowLeft, Loader2, RefreshCcw, Save, Upload, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { listAdminAudits, updateHeliosRole } from '@/services/admin/control';
import {
  applyAdminRosterImport,
  getAdminPlayerDetail,
  getCurrentEventId,
  listAdminPlayerScanHistory,
  listAdminRoster,
  listAdminRosterTeams,
  parseRosterCsvFile,
  previewAdminRosterImport,
  updateAdminPlayerContact,
  updateAdminRosterAssignment,
} from '@/services/admin/roster';

const UNASSIGNED_OPTION = '__UNASSIGNED__';

type AssignmentFilter = 'ALL' | 'ASSIGNED_PENDING' | 'ASSIGNED_ACTIVE' | 'UNASSIGNED';

function summarizeImportResult(result: RosterImportApplyResponse): string {
  return [
    `Processed ${result.summary.processed} valid rows (${result.summary.invalid} invalid).`,
    `Users created: ${result.summary.createdUsers}.`,
    `Users updated: ${result.summary.updatedUsers}.`,
    `Players created: ${result.summary.createdPlayers}.`,
    `Assignments: ${result.summary.assigned}.`,
    `Reassignments: ${result.summary.reassigned}.`,
    `Teams created: ${result.summary.createdTeams}.`,
  ].join(' ');
}

function assignmentLabel(value: AssignmentFilter): string {
  if (value === 'ALL') {
    return 'All Assignments';
  }

  if (value === 'ASSIGNED_PENDING') {
    return 'Assigned / Pending Team';
  }

  if (value === 'ASSIGNED_ACTIVE') {
    return 'Assigned / Active Team';
  }

  return 'Unassigned';
}

function formatScanOutcome(outcome: AdminPlayerScanHistoryItem['outcome']): string {
  if (outcome === 'HAZARD_PIT') {
    return 'HAZARD';
  }

  return outcome;
}

function formatJoinedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString();
}

function PlayerListView(props: { onOpenDetail: (playerId: string) => void }) {
  const { onOpenDetail } = props;

  const [eventId, setEventId] = useState<string | null>(null);
  const [roster, setRoster] = useState<ListAdminRosterResponse | null>(null);
  const [teamOptions, setTeamOptions] = useState<ListAdminRosterTeamsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [savingHeliosUserId, setSavingHeliosUserId] = useState<string | null>(null);
  const [latestAuditSummary, setLatestAuditSummary] = useState<string | null>(null);

  const [importRows, setImportRows] = useState<readonly RosterImportRowInput[] | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<RosterImportPreviewResponse | null>(null);
  const [importResultMessage, setImportResultMessage] = useState<string | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  const refreshAuditSummary = async (targetEventId: string) => {
    try {
      const audits = await listAdminAudits(targetEventId, { limit: 1 });
      const latestAudit = audits.items[0] ?? null;
      if (!latestAudit) {
        setLatestAuditSummary(null);
        return;
      }

      setLatestAuditSummary(
        `${latestAudit.actionType} by ${latestAudit.actorUserId} at ${new Date(
          latestAudit.createdAt
        ).toLocaleString()}`
      );
    } catch {
      setLatestAuditSummary(null);
    }
  };

  const loadRoster = async (overrideEventId?: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const resolvedEventId = overrideEventId ?? eventId ?? (await getCurrentEventId());
      const trimmedSearch = appliedSearch.trim();
      const rosterQuery: ListAdminRosterQuery = {
        limit: 100,
        ...(trimmedSearch.length > 0 ? { q: trimmedSearch } : {}),
        ...(assignmentFilter !== 'ALL' ? { assignmentStatus: assignmentFilter } : {}),
        ...(teamFilter !== 'ALL' ? { teamId: teamFilter } : {}),
      };

      const [nextRoster, nextTeamOptions] = await Promise.all([
        listAdminRoster(resolvedEventId, rosterQuery),
        listAdminRosterTeams(resolvedEventId),
      ]);

      setEventId(resolvedEventId);
      setRoster(nextRoster);
      setTeamOptions(nextTeamOptions);
      setAssignmentDrafts({});
      await refreshAuditSummary(resolvedEventId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load roster data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRoster();
  }, [appliedSearch, assignmentFilter, teamFilter]);

  const rosterRows = roster?.items ?? [];
  const teamSelectOptions = useMemo(() => teamOptions?.teams ?? [], [teamOptions]);

  function handleSubmitSearch(event: React.FormEvent<globalThis.HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(searchInput);
  }

  async function handleSaveAssignment(playerId: string, existingTeamId: string | null) {
    if (!eventId) {
      return;
    }

    const draft = assignmentDrafts[playerId];
    const nextTeamId = !draft || draft === UNASSIGNED_OPTION ? null : draft;
    if (nextTeamId === existingTeamId) {
      return;
    }

    setSavingPlayerId(playerId);
    try {
      await updateAdminRosterAssignment(eventId, playerId, nextTeamId);
      await loadRoster(eventId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to update assignment.');
    } finally {
      setSavingPlayerId(null);
    }
  }

  async function handleToggleHeliosRole(userId: string, isHelios: boolean) {
    if (!eventId) {
      return;
    }

    setSavingHeliosUserId(userId);
    setLoadError(null);
    try {
      await updateHeliosRole(userId, {
        isHelios: !isHelios,
      });
      await loadRoster(eventId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to update Helios role.');
    } finally {
      setSavingHeliosUserId(null);
    }
  }

  async function handleImportFileSelected(event: React.ChangeEvent<globalThis.HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsedRows = await parseRosterCsvFile(file);
      setImportRows(parsedRows);
      setImportFileName(file.name);
      setImportError(null);
      setImportPreview(null);
      setImportResultMessage(null);
    } catch (error) {
      setImportRows(null);
      setImportFileName(file.name);
      setImportPreview(null);
      setImportResultMessage(null);
      setImportError(error instanceof Error ? error.message : 'Unable to parse CSV file.');
    }
  }

  async function handlePreviewImport() {
    if (!eventId || !importRows) {
      return;
    }

    setIsPreviewingImport(true);
    setImportError(null);
    setImportResultMessage(null);

    try {
      const preview = await previewAdminRosterImport(eventId, importRows);
      setImportPreview(preview);
    } catch (error) {
      setImportPreview(null);
      setImportError(error instanceof Error ? error.message : 'Unable to preview import.');
    } finally {
      setIsPreviewingImport(false);
    }
  }

  async function handleApplyImport() {
    if (!eventId || !importRows) {
      return;
    }

    setIsApplyingImport(true);
    setImportError(null);

    try {
      const result = await applyAdminRosterImport(eventId, importRows);
      setImportPreview({
        rows: result.rows,
        summary: {
          total: result.summary.total,
          valid: result.summary.processed,
          invalid: result.summary.invalid,
          create: 0,
          update: 0,
          assign: 0,
          reassign: 0,
          unchanged: result.summary.unchanged,
        },
      });
      setImportResultMessage(summarizeImportResult(result));
      await loadRoster(eventId);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to apply import.');
    } finally {
      setIsApplyingImport(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Players</h2>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Users className="w-4 h-4" />
          <span>{rosterRows.length} roster rows</span>
          {teamOptions ? <span>• {teamOptions.unassignedCount} unassigned</span> : null}
          {eventId ? <span>• Event {eventId}</span> : null}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      ) : null}

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4">
        <h3 className="font-['Space_Grotesk'] text-lg md:text-xl">Roster Filters</h3>
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleSubmitSearch}>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, email, or team"
            className="px-3 py-2 rounded-lg bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
          />
          <select
            value={assignmentFilter}
            onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
            className="px-3 py-2 rounded-lg bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
          >
            {(['ALL', 'ASSIGNED_PENDING', 'ASSIGNED_ACTIVE', 'UNASSIGNED'] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {assignmentLabel(value)}
                </option>
              )
            )}
          </select>
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="px-3 py-2 rounded-lg bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
          >
            <option value="ALL">All Teams</option>
            {teamSelectOptions.map((team) => (
              <option key={team.teamId} value={team.teamId}>
                {team.teamName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[#00D4FF] text-black font-semibold hover:opacity-90"
          >
            Apply Filters
          </button>
        </form>
      </article>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4">
        <h3 className="font-['Space_Grotesk'] text-lg md:text-xl">Roster Import (CSV)</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-gray-700 cursor-pointer hover:border-[#00D4FF]">
            <Upload className="w-4 h-4" />
            <span className="text-sm">Choose CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportFileSelected}
            />
          </label>
          <button
            type="button"
            onClick={() => void handlePreviewImport()}
            disabled={!importRows || isPreviewingImport}
            className="px-3 py-2 rounded-lg bg-[#00D4FF] text-black font-semibold disabled:opacity-50"
          >
            {isPreviewingImport ? 'Previewing…' : 'Preview Import'}
          </button>
          <button
            type="button"
            onClick={() => void handleApplyImport()}
            disabled={!importRows || isApplyingImport}
            className="px-3 py-2 rounded-lg bg-[#39FF14] text-black font-semibold disabled:opacity-50"
          >
            {isApplyingImport ? 'Applying…' : 'Apply Import'}
          </button>
          <button
            type="button"
            onClick={() => void loadRoster(eventId ?? undefined)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 hover:border-[#00D4FF]"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {latestAuditSummary ? (
          <p className="text-xs text-gray-400">Latest admin audit: {latestAuditSummary}</p>
        ) : null}

        {importFileName ? (
          <p className="text-xs text-gray-400">Loaded file: {importFileName}</p>
        ) : null}
        {importError ? (
          <p className="text-sm text-red-300 rounded-lg border border-red-500/40 bg-red-500/10 p-2">
            {importError}
          </p>
        ) : null}
        {importResultMessage ? (
          <p className="text-sm text-green-300 rounded-lg border border-green-500/40 bg-green-500/10 p-2">
            {importResultMessage}
          </p>
        ) : null}

        {importPreview ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Preview summary: {importPreview.summary.total} rows, {importPreview.summary.valid}{' '}
              valid, {importPreview.summary.invalid} invalid.
            </p>
            <div className="max-h-56 overflow-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-black/40 text-gray-300">
                  <tr>
                    <th className="text-left px-3 py-2">Row</th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">Action</th>
                    <th className="text-left px-3 py-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row) => (
                    <tr
                      key={`${row.normalizedWorkEmail}-${row.rowNumber}`}
                      className="border-t border-gray-800"
                    >
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.normalizedWorkEmail}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2 text-xs text-red-300">
                        {row.errors.join('; ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6">
        <h3 className="font-['Space_Grotesk'] text-lg md:text-xl mb-3">Roster Directory</h3>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading roster…
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-black/40 text-gray-300">
                <tr>
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-left px-3 py-2">Work Email</th>
                  <th className="text-left px-3 py-2">Helios</th>
                  <th className="text-left px-3 py-2">Phone</th>
                  <th className="text-left px-3 py-2">Assignment</th>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-left px-3 py-2">Update</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.map((row) => {
                  const selectedTeamId =
                    assignmentDrafts[row.playerId] ?? row.teamId ?? UNASSIGNED_OPTION;
                  const hasChanges =
                    (selectedTeamId === UNASSIGNED_OPTION ? null : selectedTeamId) !== row.teamId;
                  const isSaving = savingPlayerId === row.playerId;

                  return (
                    <tr key={row.playerId} className="border-t border-gray-800 align-top">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenDetail(row.playerId)}
                          className="font-semibold text-left hover:text-[#00D4FF]"
                        >
                          {row.displayName}
                        </button>
                        <p className="text-xs text-gray-500">{row.playerId}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.workEmail}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={savingHeliosUserId === row.userId}
                          onClick={() => void handleToggleHeliosRole(row.userId, row.isHelios)}
                          className={`px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 ${
                            row.isHelios
                              ? 'bg-[#39FF14]/20 border border-[#39FF14]/40 text-[#39FF14]'
                              : 'bg-black/40 border border-gray-700 text-gray-300'
                          }`}
                        >
                          {savingHeliosUserId === row.userId
                            ? 'Saving…'
                            : row.isHelios
                              ? 'Revoke'
                              : 'Assign'}
                        </button>
                      </td>
                      <td className="px-3 py-2">{row.phoneE164 ?? '—'}</td>
                      <td className="px-3 py-2">{row.assignmentStatus}</td>
                      <td className="px-3 py-2">
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
                          {teamSelectOptions.map((team) => (
                            <option key={team.teamId} value={team.teamId}>
                              {team.teamName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={!hasChanges || isSaving}
                          onClick={() => void handleSaveAssignment(row.playerId, row.teamId)}
                          className="px-2 py-1 rounded bg-[#00D4FF] text-black font-semibold disabled:opacity-50"
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

function PlayerDetailView(props: { playerId: string; onBack: () => void }) {
  const { playerId, onBack } = props;
  const [eventId, setEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getAdminPlayerDetail>> | null>(
    null
  );
  const [scanHistory, setScanHistory] = useState<readonly AdminPlayerScanHistoryItem[]>([]);
  const [workEmailDraft, setWorkEmailDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');

  const loadDetail = async (overrideEventId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const resolvedEventId = overrideEventId ?? eventId ?? (await getCurrentEventId());
      const [nextDetail, nextScanHistory] = await Promise.all([
        getAdminPlayerDetail(resolvedEventId, playerId),
        listAdminPlayerScanHistory(resolvedEventId, playerId, {
          limit: 100,
        }),
      ]);

      setEventId(resolvedEventId);
      setDetail(nextDetail);
      setScanHistory(nextScanHistory.items);
      setWorkEmailDraft(nextDetail.workEmail);
      setPhoneDraft(nextDetail.phoneE164 ?? '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load player detail.');
      setDetail(null);
      setScanHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [playerId]);

  async function handleSaveContact() {
    if (!eventId || !detail) {
      return;
    }

    setIsSavingContact(true);
    setError(null);
    try {
      await updateAdminPlayerContact(eventId, playerId, {
        workEmail: workEmailDraft,
        phoneE164: phoneDraft.trim().length > 0 ? phoneDraft.trim() : null,
      });
      await loadDetail(eventId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save contact details.');
    } finally {
      setIsSavingContact(false);
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
        Back to Players
      </button>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading player detail…
        </div>
      ) : detail ? (
        <>
          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4">
            <div>
              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">{detail.displayName}</h2>
              <p className="text-xs text-gray-400 font-mono">{detail.playerId}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Individual Score</p>
                <p className="text-2xl font-semibold text-[#39FF14]">{detail.individualScore}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Global Rank</p>
                <p className="text-2xl font-semibold">
                  {detail.globalRank !== null ? `#${detail.globalRank}` : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Team Rank</p>
                <p className="text-2xl font-semibold">
                  {detail.teamRank !== null ? `#${detail.teamRank}` : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Team Points</p>
                <p className="text-2xl font-semibold">{detail.teamScore ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Joined</p>
                <p className="text-2xl font-semibold">{formatJoinedDate(detail.joinedAt)}</p>
              </div>
            </div>

            <div className="text-sm text-gray-300">
              Team: {detail.teamName ? `${detail.teamName} (${detail.teamId})` : 'Unassigned'}
            </div>
          </article>

          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6 space-y-4">
            <h3 className="font-['Space_Grotesk'] text-lg md:text-xl">Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Work Email</span>
                <input
                  type="email"
                  value={workEmailDraft}
                  onChange={(event) => setWorkEmailDraft(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-gray-400">Phone (E.164)</span>
                <input
                  type="text"
                  value={phoneDraft}
                  onChange={(event) => setPhoneDraft(event.target.value)}
                  placeholder="+14155550123"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-gray-700 focus:outline-none focus:border-[#00D4FF]"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={isSavingContact}
              onClick={() => void handleSaveContact()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#00D4FF] text-black font-semibold disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSavingContact ? 'Saving…' : 'Save Contact'}
            </button>
          </article>

          <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6">
            <h3 className="font-['Space_Grotesk'] text-lg md:text-xl mb-3">Scan History</h3>
            {scanHistory.length === 0 ? (
              <p className="text-sm text-gray-400">No scans recorded for this player yet.</p>
            ) : (
              <div className="overflow-auto rounded-lg border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-black/40 text-gray-300">
                    <tr>
                      <th className="text-left px-3 py-2">Outcome</th>
                      <th className="text-left px-3 py-2">Timestamp</th>
                      <th className="text-left px-3 py-2">QR Label</th>
                      <th className="text-left px-3 py-2">Points</th>
                      <th className="text-left px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanHistory.map((scan) => (
                      <tr key={scan.scanId} className="border-t border-gray-800">
                        <td className="px-3 py-2 font-mono text-xs">
                          {formatScanOutcome(scan.outcome)}
                        </td>
                        <td className="px-3 py-2">{new Date(scan.scannedAt).toLocaleString()}</td>
                        <td className="px-3 py-2">{scan.qrCodeLabel ?? scan.qrPayload}</td>
                        <td className="px-3 py-2">{scan.pointsAwarded}</td>
                        <td className="px-3 py-2">{scan.message ?? '—'}</td>
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

export default function AdminPlayers() {
  const navigate = useNavigate();
  const { playerId } = useParams<{ playerId?: string }>();

  if (playerId) {
    return <PlayerDetailView playerId={playerId} onBack={() => navigate('/admin/players')} />;
  }

  return (
    <PlayerListView onOpenDetail={(nextPlayerId) => navigate(`/admin/players/${nextPlayerId}`)} />
  );
}
