import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Loader2,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { QRCodeSummary, QrImportPreviewResponse, QrImportRowInput } from '@/services/api';
import {
  applyQrImport,
  createAdminQRCode,
  deleteAdminQRCode,
  exportQrAssets,
  listAdminQRCodes,
  parseQrCsvFile,
  previewQrImport,
  setAdminQRCodeStatus,
  updateAdminQrHazardOverrides,
} from '@/services/admin/qrCodes';
import { getCurrentEventId } from '@/services/admin/roster';
import { adminDemoQrCodes, type AdminQrCode } from '../../admin/adminViewData';

function toAdminQrCode(qrCode: QRCodeSummary): AdminQrCode {
  return {
    id: qrCode.id,
    name: qrCode.label,
    points: qrCode.value,
    zone: qrCode.zone,
    payload: qrCode.payload,
    qrImageUrl: qrCode.qrImageUrl,
    active: qrCode.status === 'ACTIVE',
    scanCount: qrCode.scanCount,
    hazardRatioOverride: qrCode.hazardRatioOverride,
    hazardWeightOverride: qrCode.hazardWeightOverride,
    activationStartsAt: qrCode.activationStartsAt,
    activationEndsAt: qrCode.activationEndsAt,
  };
}

function toApiIsoDateTime(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function clampHazardWeight(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.trunc(value);
}

function clampHazardRatio(value: number): number {
  if (value < 1) {
    return 1;
  }

  if (value > 10_000) {
    return 10_000;
  }

  return Math.trunc(value);
}

function formatActivationWindow(start: string | null, end: string | null): string {
  if (!start && !end) {
    return 'Always active';
  }

  const startLabel = start ? new Date(start).toLocaleString() : 'Now';
  const endLabel = end ? new Date(end).toLocaleString() : 'No end';

  return `${startLabel} -> ${endLabel}`;
}

function downloadQrAsset(qrCode: AdminQrCode): void {
  if (!qrCode.qrImageUrl) {
    return;
  }

  const link = document.createElement('a');
  link.href = qrCode.qrImageUrl;
  link.download = `${qrCode.name.replace(/\s+/g, '-').toLowerCase()}.png`;
  link.rel = 'noopener noreferrer';
  document.body.append(link);
  link.click();
  link.remove();
}

function downloadZipArchive(fileName: string, base64Payload: string, mimeType: string): void {
  const binary = window.atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new window.Blob([bytes], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function AdminQrCodes() {
  const [qrCodes, setQrCodes] = useState<AdminQrCode[]>(adminDemoQrCodes);
  const [eventId, setEventId] = useState<string | null>(null);
  const [newQRName, setNewQRName] = useState('');
  const [newQRPoints, setNewQRPoints] = useState('100');
  const [newQRZone, setNewQRZone] = useState('');
  const [activationStartsAt, setActivationStartsAt] = useState('');
  const [activationEndsAt, setActivationEndsAt] = useState('');
  const [isHydrating, setIsHydrating] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftWeights, setDraftWeights] = useState<Record<string, number>>({});
  const [draftRatios, setDraftRatios] = useState<Record<string, number>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [importRows, setImportRows] = useState<readonly QrImportRowInput[]>([]);
  const [importPreview, setImportPreview] = useState<QrImportPreviewResponse | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function hydrateQrCodes(nextEventId: string) {
    const qrResponse = await listAdminQRCodes(nextEventId);
    const nextQrCodes = qrResponse.qrCodes.map(toAdminQrCode);
    setQrCodes(nextQrCodes);
    setDraftWeights(
      Object.fromEntries(nextQrCodes.map((code) => [code.id, code.hazardWeightOverride ?? 0]))
    );
    setDraftRatios(
      Object.fromEntries(nextQrCodes.map((code) => [code.id, code.hazardRatioOverride ?? 1]))
    );
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setIsHydrating(true);
      setLoadError(null);

      try {
        const nextEventId = await getCurrentEventId();
        if (!isMounted) {
          return;
        }

        setEventId(nextEventId);
        await hydrateQrCodes(nextEventId);
      } catch {
        if (!isMounted) {
          return;
        }

        setEventId(null);
        setQrCodes(adminDemoQrCodes);
        setDraftWeights(
          Object.fromEntries(
            adminDemoQrCodes.map((code) => [code.id, code.hazardWeightOverride ?? 0])
          )
        );
        setDraftRatios(
          Object.fromEntries(
            adminDemoQrCodes.map((code) => [code.id, code.hazardRatioOverride ?? 1])
          )
        );
        setLoadError('Live QR inventory unavailable. Showing local demo data.');
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const isDemoMode = eventId === null;
  const activeCount = useMemo(() => qrCodes.filter((code) => code.active).length, [qrCodes]);

  async function handleCreateQRCode() {
    if (isDemoMode || !eventId || isCreating) {
      return;
    }

    if (!newQRName.trim()) {
      setLoadError('QR code name is required.');
      return;
    }

    const points = Number.parseInt(newQRPoints, 10);
    if (!Number.isFinite(points) || points <= 0) {
      setLoadError('Point value must be a positive integer.');
      return;
    }

    if (activationStartsAt && activationEndsAt && activationStartsAt >= activationEndsAt) {
      setLoadError('Activation end must be later than activation start.');
      return;
    }

    setIsCreating(true);
    setLoadError(null);

    try {
      const request = {
        label: newQRName.trim(),
        value: points,
        zone: newQRZone.trim() || undefined,
        activationStartsAt: toApiIsoDateTime(activationStartsAt),
        activationEndsAt: toApiIsoDateTime(activationEndsAt),
      };

      await createAdminQRCode(eventId, request);
      await hydrateQrCodes(eventId);

      setNewQRName('');
      setNewQRPoints('100');
      setNewQRZone('');
      setActivationStartsAt('');
      setActivationEndsAt('');
    } catch {
      setLoadError('Unable to create QR code. Verify n8n QR generation is available.');
    } finally {
      setIsCreating(false);
    }
  }

  async function toggleStatus(id: string) {
    if (!eventId) {
      setRowErrors((existing) => ({
        ...existing,
        [id]: 'Status updates are unavailable in demo mode.',
      }));
      return;
    }

    const target = qrCodes.find((code) => code.id === id);
    if (!target) {
      return;
    }

    const nextStatus = target.active ? 'DISABLED' : 'ACTIVE';
    setSavingById((existing) => ({ ...existing, [id]: true }));
    setRowErrors((existing) => ({ ...existing, [id]: null }));

    try {
      await setAdminQRCodeStatus(eventId, id, { status: nextStatus });
      setQrCodes((existing) =>
        existing.map((code) => (code.id === id ? { ...code, active: !code.active } : code))
      );
    } catch {
      setRowErrors((existing) => ({ ...existing, [id]: 'Unable to update QR status. Try again.' }));
    } finally {
      setSavingById((existing) => ({ ...existing, [id]: false }));
    }
  }

  async function removeCode(id: string) {
    if (!eventId) {
      setRowErrors((existing) => ({ ...existing, [id]: 'Delete is unavailable in demo mode.' }));
      return;
    }

    setSavingById((existing) => ({ ...existing, [id]: true }));
    setRowErrors((existing) => ({ ...existing, [id]: null }));

    try {
      await deleteAdminQRCode(eventId, id);
      setQrCodes((existing) => existing.filter((code) => code.id !== id));
      setDraftWeights((existing) => {
        const next = { ...existing };
        delete next[id];
        return next;
      });
      setDraftRatios((existing) => {
        const next = { ...existing };
        delete next[id];
        return next;
      });
    } catch {
      setRowErrors((existing) => ({ ...existing, [id]: 'Unable to delete QR code. Try again.' }));
    } finally {
      setSavingById((existing) => ({ ...existing, [id]: false }));
    }
  }

  function updateDraftWeight(id: string, value: number) {
    setDraftWeights((existing) => ({ ...existing, [id]: clampHazardWeight(value) }));
  }

  function updateDraftRatio(id: string, value: number) {
    setDraftRatios((existing) => ({ ...existing, [id]: clampHazardRatio(value) }));
  }

  async function persistHazardOverrides(
    id: string,
    mode: 'save' | 'fallback-weight' | 'fallback-ratio'
  ) {
    if (!eventId) {
      setRowErrors((existing) => ({
        ...existing,
        [id]: 'Hazard persistence is unavailable in demo mode.',
      }));
      return;
    }

    setSavingById((existing) => ({ ...existing, [id]: true }));
    setRowErrors((existing) => ({ ...existing, [id]: null }));

    try {
      const request =
        mode === 'fallback-weight'
          ? { hazardWeightOverride: null }
          : mode === 'fallback-ratio'
            ? { hazardRatioOverride: null }
            : {
                hazardWeightOverride: clampHazardWeight(draftWeights[id] ?? 0),
                hazardRatioOverride: clampHazardRatio(draftRatios[id] ?? 1),
              };

      const response = await updateAdminQrHazardOverrides(eventId, id, request);

      setQrCodes((existing) =>
        existing.map((code) =>
          code.id === id
            ? {
                ...code,
                hazardWeightOverride: response.hazardWeightOverride,
                hazardRatioOverride: response.hazardRatioOverride,
              }
            : code
        )
      );

      setDraftWeights((existing) => ({ ...existing, [id]: response.hazardWeightOverride ?? 0 }));
      setDraftRatios((existing) => ({ ...existing, [id]: response.hazardRatioOverride ?? 1 }));
    } catch {
      setRowErrors((existing) => ({
        ...existing,
        [id]: 'Unable to save hazard overrides. Try again.',
      }));
    } finally {
      setSavingById((existing) => ({ ...existing, [id]: false }));
    }
  }

  async function handleCsvUpload(event: React.ChangeEvent<globalThis.HTMLInputElement>) {
    if (!event.target.files || event.target.files.length === 0 || !eventId) {
      return;
    }

    const [file] = event.target.files;
    setIsPreviewingImport(true);
    setLoadError(null);

    try {
      const rows = await parseQrCsvFile(file);
      const preview = await previewQrImport(eventId, rows);
      setImportRows(rows);
      setImportPreview(preview);
    } catch {
      setLoadError('Unable to parse/preview QR CSV import. Check required headers and row values.');
      setImportRows([]);
      setImportPreview(null);
    } finally {
      setIsPreviewingImport(false);
      event.target.value = '';
    }
  }

  async function handleApplyImport() {
    if (!eventId || importRows.length === 0) {
      return;
    }

    setIsApplyingImport(true);
    setLoadError(null);
    try {
      await applyQrImport(eventId, importRows);
      await hydrateQrCodes(eventId);
      const refreshedPreview = await previewQrImport(eventId, importRows);
      setImportPreview(refreshedPreview);
    } catch {
      setLoadError('Unable to apply QR import.');
    } finally {
      setIsApplyingImport(false);
    }
  }

  async function handleExportAssets() {
    if (!eventId) {
      return;
    }

    setIsExporting(true);
    setLoadError(null);

    try {
      const exported = await exportQrAssets(
        eventId,
        qrCodes.map((code) => code.id)
      );
      downloadZipArchive(exported.fileName, exported.archiveBase64, exported.mimeType);
    } catch {
      setLoadError('Unable to export QR assets zip archive.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">QR Codes</h2>
        <div className="text-right">
          <p className="text-sm text-gray-400">
            {activeCount} active / {qrCodes.length} total
          </p>
          {eventId && <p className="text-xs text-gray-500 mt-1">Event: {eventId}</p>}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          {loadError}
        </div>
      )}

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-4 flex items-center gap-2">
          <Upload className="w-6 h-6 text-[#00D4FF]" />
          Bulk QR Import (CSV)
        </h3>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-black/30 text-sm cursor-pointer hover:border-[#00D4FF]/60">
            <Upload className="w-4 h-4" />
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                void handleCsvUpload(event);
              }}
              disabled={isDemoMode || isPreviewingImport}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              void handleApplyImport();
            }}
            disabled={isDemoMode || isApplyingImport || !importPreview || importRows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/30 text-[#00D4FF] disabled:opacity-50"
          >
            {isApplyingImport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Apply Import
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExportAssets();
            }}
            disabled={isDemoMode || isExporting || qrCodes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14] disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export ZIP
          </button>
        </div>

        {importPreview && (
          <div className="mt-4 rounded-lg border border-gray-700 bg-black/30 p-3 text-sm">
            <p className="text-gray-300">
              Preview: {importPreview.summary.valid} valid / {importPreview.summary.invalid} invalid
              / {importPreview.summary.total} total
            </p>
            <div className="max-h-44 overflow-auto mt-2 space-y-1">
              {importPreview.rows.slice(0, 25).map((row) => (
                <div key={`${row.rowNumber}-${row.label}`} className="text-xs text-gray-400">
                  Row {row.rowNumber}: {row.label} ({row.action})
                  {row.errors.length > 0 ? ` - ${row.errors.join('; ')}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </article>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-4 flex items-center gap-2">
          <Plus className="w-6 h-6 text-[#00D4FF]" />
          Create New QR Code
        </h3>
        {!isHydrating && isDemoMode && (
          <p className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
            Live QR creation is disabled in demo mode.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">QR Code Name</label>
            <input
              type="text"
              value={newQRName}
              onChange={(event) => setNewQRName(event.target.value)}
              placeholder="e.g., Checkpoint Alpha"
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Point Value</label>
            <input
              type="number"
              value={newQRPoints}
              onChange={(event) => setNewQRPoints(event.target.value)}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Zone (Optional)</label>
            <input
              type="text"
              value={newQRZone}
              onChange={(event) => setNewQRZone(event.target.value)}
              placeholder="e.g., Atrium"
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Activation Start (Optional)</label>
            <input
              type="datetime-local"
              value={activationStartsAt}
              onChange={(event) => setActivationStartsAt(event.target.value)}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Activation End (Optional)</label>
            <input
              type="datetime-local"
              value={activationEndsAt}
              onChange={(event) => setActivationEndsAt(event.target.value)}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void handleCreateQRCode();
              }}
              disabled={isDemoMode || isCreating}
              className="w-full py-3 px-6 bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-black font-['DM_Sans'] font-bold rounded-lg hover:opacity-90 transition-all disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Generate QR Code
            </button>
          </div>
        </div>
      </article>

      {isHydrating ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-800 bg-black/30 p-4 text-sm text-gray-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading QR inventory...
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {qrCodes.map((qrCode) => {
          const draftWeight = draftWeights[qrCode.id] ?? qrCode.hazardWeightOverride ?? 0;
          const draftRatio = draftRatios[qrCode.id] ?? qrCode.hazardRatioOverride ?? 1;
          const isSaving = Boolean(savingById[qrCode.id]);
          const rowError = rowErrors[qrCode.id];

          return (
            <article
              key={qrCode.id}
              className={`bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border rounded-xl p-6 ${
                qrCode.active ? 'border-[#39FF14]/30' : 'border-gray-800 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-['Space_Grotesk'] text-lg">{qrCode.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-mono ${
                    qrCode.active ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {qrCode.active ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-lg mb-4">
                {qrCode.qrImageUrl ? (
                  <img
                    src={qrCode.qrImageUrl}
                    alt={`QR code for ${qrCode.name}`}
                    className="aspect-square w-full rounded-md border border-gray-200 object-contain"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-md border border-gray-200 grid place-items-center bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)]">
                    <QrCode className="w-20 h-20 text-gray-800" />
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Zone:</span>
                  <span className="font-mono text-gray-200">{qrCode.zone ?? 'Unassigned'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Points:</span>
                  <span className="font-mono text-[#39FF14]">+{qrCode.points}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Scans:</span>
                  <span className="font-mono text-[#00D4FF]">{qrCode.scanCount}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatActivationWindow(qrCode.activationStartsAt, qrCode.activationEndsAt)}
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-gray-700/80 bg-black/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                    Hazard Overrides
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 w-24">Ratio</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={draftRatio}
                    onChange={(event) => updateDraftRatio(qrCode.id, Number(event.target.value))}
                    className="w-28 px-2 py-1 bg-black/50 border border-gray-700 rounded text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void persistHazardOverrides(qrCode.id, 'fallback-ratio');
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold disabled:opacity-60"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Fallback Ratio
                  </button>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={draftWeight}
                  onChange={(event) => updateDraftWeight(qrCode.id, Number(event.target.value))}
                  className="w-full"
                  aria-label={`Hazard randomizer slider for ${qrCode.name}`}
                />

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 w-24">Weight %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftWeight}
                    onChange={(event) => updateDraftWeight(qrCode.id, Number(event.target.value))}
                    className="w-24 px-2 py-1 bg-black/50 border border-gray-700 rounded text-sm text-white"
                    aria-label={`Hazard randomizer value for ${qrCode.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void persistHazardOverrides(qrCode.id, 'save');
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#00D4FF]/15 border border-[#00D4FF]/30 text-[#00D4FF] text-xs font-semibold disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void persistHazardOverrides(qrCode.id, 'fallback-weight');
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold disabled:opacity-60"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Fallback Weight
                  </button>
                </div>

                <p className="text-xs text-gray-400">
                  Ratio:{' '}
                  {qrCode.hazardRatioOverride === null
                    ? 'event global ratio'
                    : qrCode.hazardRatioOverride}
                  . Weight:{' '}
                  {qrCode.hazardWeightOverride === null
                    ? 'ratio mode'
                    : `${qrCode.hazardWeightOverride}%`}
                  .
                </p>

                {rowError && <p className="text-xs text-red-300">{rowError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    void toggleStatus(qrCode.id);
                  }}
                  disabled={isSaving}
                  className={`py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1 disabled:opacity-60 ${
                    qrCode.active
                      ? 'bg-[#FF3939]/20 text-[#FF3939] border border-[#FF3939]/30 hover:bg-[#FF3939]/30'
                      : 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/30'
                  }`}
                >
                  {qrCode.active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  {qrCode.active ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadQrAsset(qrCode)}
                  disabled={!qrCode.qrImageUrl}
                  className="py-2 px-3 bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg hover:bg-[#00D4FF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  void removeCode(qrCode.id);
                }}
                disabled={isSaving}
                className="w-full py-2 px-3 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
