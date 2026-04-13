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

type RosterRow = ListAdminRosterResponse['items'][number];

function assignmentStatusPillClass(status: RosterRow['assignmentStatus']): string {
  if (status === 'ASSIGNED_ACTIVE') {
    return 'border border-[#39FF14]/40 bg-[#39FF14]/15 text-[#39FF14]';
  }

  if (status === 'ASSIGNED_PENDING') {
    return 'border border-[#FACC15]/40 bg-[#FACC15]/15 text-[#FACC15]';
  }

  return 'border border-gray-700 bg-black/40 text-gray-300';
}

function scanOutcomePillClass(outcome: AdminPlayerScanHistoryItem['outcome']): string {
  if (outcome === 'SAFE') {
    return 'border border-[#39FF14]/40 bg-[#39FF14]/15 text-[#39FF14]';
  }

  if (outcome === 'HAZARD_PIT') {
    return 'border border-[#FF3939]/40 bg-[#FF3939]/15 text-[#FF3939]';
  }

  return 'border border-gray-700 bg-black/40 text-gray-300';
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Players</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
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
            className="rounded-lg bg-[#00D4FF] px-3 py-2 font-semibold text-black hover:opacity-90 md:col-span-1"
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
            className="w-full rounded-lg bg-[#00D4FF] px-3 py-2 font-semibold text-black disabled:opacity-50 sm:w-auto"
          >
            {isPreviewingImport ? 'Previewing…' : 'Preview Import'}
          </button>
          <button
            type="button"
            onClick={() => void handleApplyImport()}
            disabled={!importRows || isApplyingImport}
            className="w-full rounded-lg bg-[#39FF14] px-3 py-2 font-semibold text-black disabled:opacity-50 sm:w-auto"
          >
            {isApplyingImport ? 'Applying…' : 'Apply Import'}
          </button>
          <button
            type="button"
            onClick={() => void loadRoster(eventId ?? undefined)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 hover:border-[#00D4FF] sm:w-auto"
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
            <div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-gray-800 p-2">
              {importPreview.rows.map((row) => (
                <div
                  key={`${row.normalizedWorkEmail}-${row.rowNumber}`}
                  className="rounded-lg border border-gray-700 bg-black/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-gray-400">Row {row.rowNumber}</span>
                    <span className="rounded border border-gray-700 bg-black/40 px-2 py-0.5 text-xs uppercase tracking-wide text-gray-300">
                      {row.action}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-gray-200">
                    {row.normalizedWorkEmail}
                  </p>
                  <p className="mt-2 text-xs text-red-300">{row.errors.join('; ') || '—'}</p>
                </div>
              ))}
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
        ) : rosterRows.length === 0 ? (
          <p className="rounded-lg border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
            No players match the current filters.
          </p>
        ) : (
          <div className="space-y-3">
            {rosterRows.map((row) => {
              const selectedTeamId =
                assignmentDrafts[row.playerId] ?? row.teamId ?? UNASSIGNED_OPTION;
              const hasChanges =
                (selectedTeamId === UNASSIGNED_OPTION ? null : selectedTeamId) !== row.teamId;
              const isSaving = savingPlayerId === row.playerId;

              return (
                <article
                  key={row.playerId}
                  className="rounded-lg border border-gray-800 bg-black/30 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <button
                        type="button"
                        onClick={() => onOpenDetail(row.playerId)}
                        className="font-['Space_Grotesk'] text-left text-lg font-semibold hover:text-[#00D4FF]"
                      >
                        {row.displayName}
                      </button>
                      <p className="break-all font-mono text-xs text-gray-300">{row.workEmail}</p>
                      <p className="text-xs text-gray-500">{row.playerId}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${assignmentStatusPillClass(
                          row.assignmentStatus
                        )}`}
                      >
                        {row.assignmentStatus}
                      </span>
                      <button
                        type="button"
                        disabled={savingHeliosUserId === row.userId}
                        onClick={() => void handleToggleHeliosRole(row.userId, row.isHelios)}
                        className={`rounded px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
                          row.isHelios
                            ? 'border border-[#39FF14]/40 bg-[#39FF14]/20 text-[#39FF14]'
                            : 'border border-gray-700 bg-black/40 text-gray-300'
                        }`}
                      >
                        {savingHeliosUserId === row.userId
                          ? 'Saving…'
                          : row.isHelios
                            ? 'Revoke'
                            : 'Assign'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        Team: {row.teamName ?? 'Unassigned'}
                        {row.teamStatus ? ` (${row.teamStatus})` : ''}
                      </p>
                      <p className="text-xs text-gray-400">Phone: {row.phoneE164 ?? '—'}</p>
                      <select
                        aria-label={`Assign team for ${row.displayName}`}
                        value={selectedTeamId}
                        onChange={(event) =>
                          setAssignmentDrafts((existing) => ({
                            ...existing,
                            [row.playerId]: event.target.value,
                          }))
                        }
                        className="w-full rounded bg-black/40 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-[#00D4FF]"
                      >
                        <option value={UNASSIGNED_OPTION}>Unassigned</option>
                        {teamSelectOptions.map((team) => (
                          <option key={team.teamId} value={team.teamId}>
                            {team.teamName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={!hasChanges || isSaving}
                      onClick={() => void handleSaveAssignment(row.playerId, row.teamId)}
                      className="w-full rounded bg-[#00D4FF] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50 md:w-auto"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </article>
              );
            })}
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
            <div className="space-y-1">
              <h2 className="font-['Space_Grotesk'] text-2xl break-words md:text-3xl">
                {detail.displayName}
              </h2>
              <p className="text-xs text-gray-400 font-mono">{detail.playerId}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Individual Score</p>
                <p className="text-xl font-semibold text-[#39FF14] sm:text-2xl">
                  {detail.individualScore}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Global Rank</p>
                <p className="text-xl font-semibold sm:text-2xl">
                  {detail.globalRank !== null ? `#${detail.globalRank}` : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Team Rank</p>
                <p className="text-xl font-semibold sm:text-2xl">
                  {detail.teamRank !== null ? `#${detail.teamRank}` : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Team Points</p>
                <p className="text-xl font-semibold sm:text-2xl">{detail.teamScore ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-black/30 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Joined</p>
                <p className="text-base font-semibold sm:text-lg">
                  {formatJoinedDate(detail.joinedAt)}
                </p>
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
              className="inline-flex w-full items-center justify-center gap-2 rounded bg-[#00D4FF] px-3 py-2 font-semibold text-black disabled:opacity-50 sm:w-auto"
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
              <div className="space-y-2">
                {scanHistory.map((scan) => (
                  <article
                    key={scan.scanId}
                    className="rounded-lg border border-gray-800 bg-black/30 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-xs ${scanOutcomePillClass(scan.outcome)}`}
                      >
                        {formatScanOutcome(scan.outcome)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(scan.scannedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-200">
                      {scan.qrCodeLabel ?? scan.qrPayload}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
                      <span>Points: {scan.pointsAwarded}</span>
                      <span>{scan.message ?? '—'}</span>
                    </div>
                  </article>
                ))}
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
