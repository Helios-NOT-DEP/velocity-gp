import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, QrCode, RefreshCcw, Save, Trash2, X } from 'lucide-react';
import {
  adminEndpoints,
  apiClient,
  eventEndpoints,
  hazardEndpoints,
  type EventSummary,
  type Hazard,
  type UpdateQrHazardRandomizerResponse,
} from '@/services/api';
import { adminDemoQrCodes, type AdminQrCode } from '../../admin/adminViewData';

function toAdminQrCode(hazard: Hazard): AdminQrCode {
  return {
    id: hazard.id,
    name: hazard.label,
    points: hazard.value,
    active: hazard.status === 'ACTIVE',
    scanCount: hazard.scanCount,
    hazardRatioOverride: hazard.hazardRatioOverride,
    hazardWeightOverride: hazard.hazardWeightOverride,
  };
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

export default function AdminQrCodes() {
  const [qrCodes, setQrCodes] = useState<AdminQrCode[]>(adminDemoQrCodes);
  const [eventId, setEventId] = useState<string | null>(null);
  const [newQRName, setNewQRName] = useState('');
  const [newQRPoints, setNewQRPoints] = useState('100');
  const [isHydrating, setIsHydrating] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftWeights, setDraftWeights] = useState<Record<string, number>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let isMounted = true;

    async function hydrateQrCodes() {
      setIsHydrating(true);
      setLoadError(null);

      try {
        const eventResponse = await apiClient.get<EventSummary>(eventEndpoints.getCurrentEvent);
        if (!eventResponse.ok) {
          throw new Error(`Failed to load current event: ${eventResponse.status}`);
        }

        const nextEventId = eventResponse.data.id;
        const qrResponse = await apiClient.get<Hazard[]>(hazardEndpoints.listHazards(nextEventId));
        if (!qrResponse.ok) {
          throw new Error(`Failed to load QR inventory: ${qrResponse.status}`);
        }

        if (!isMounted) {
          return;
        }

        const nextQrCodes = qrResponse.data.map(toAdminQrCode);
        setEventId(nextEventId);
        setQrCodes(nextQrCodes);
        setDraftWeights(
          Object.fromEntries(nextQrCodes.map((code) => [code.id, code.hazardWeightOverride ?? 0]))
        );
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
        setLoadError('Live QR inventory unavailable. Showing local demo data.');
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateQrCodes();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeCount = useMemo(() => qrCodes.filter((code) => code.active).length, [qrCodes]);

  function handleCreateQRCode() {
    if (!newQRName.trim()) {
      return;
    }

    const points = Number.parseInt(newQRPoints, 10);
    if (!Number.isFinite(points) || points <= 0) {
      return;
    }

    const createdId = `qr-${Date.now()}`;
    setQrCodes((existing) => [
      {
        id: createdId,
        name: newQRName.trim(),
        points,
        active: true,
        scanCount: 0,
        hazardRatioOverride: null,
        hazardWeightOverride: null,
      },
      ...existing,
    ]);

    setDraftWeights((existing) => ({ ...existing, [createdId]: 0 }));
    setNewQRName('');
    setNewQRPoints('100');
  }

  function toggleStatus(id: string) {
    setQrCodes((existing) =>
      existing.map((code) => (code.id === id ? { ...code, active: !code.active } : code))
    );
  }

  function removeCode(id: string) {
    setQrCodes((existing) => existing.filter((code) => code.id !== id));
    setDraftWeights((existing) => {
      const next = { ...existing };
      delete next[id];
      return next;
    });
  }

  function updateDraftWeight(id: string, value: number) {
    setDraftWeights((existing) => ({
      ...existing,
      [id]: clampHazardWeight(value),
    }));
  }

  async function persistHazardWeight(id: string, nextWeight: number | null) {
    if (!eventId) {
      setRowErrors((existing) => ({
        ...existing,
        [id]: 'Weight persistence is unavailable in demo mode.',
      }));
      return;
    }

    setSavingById((existing) => ({ ...existing, [id]: true }));
    setRowErrors((existing) => ({ ...existing, [id]: null }));

    try {
      const response = await apiClient.request<UpdateQrHazardRandomizerResponse>(
        adminEndpoints.updateQrHazardRandomizer(eventId, id),
        {
          method: 'PATCH',
          body: {
            hazardWeightOverride: nextWeight,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to persist hazard weight (${response.status}).`);
      }

      setQrCodes((existing) =>
        existing.map((code) =>
          code.id === id
            ? {
                ...code,
                hazardWeightOverride: response.data.hazardWeightOverride,
              }
            : code
        )
      );

      setDraftWeights((existing) => ({
        ...existing,
        [id]: response.data.hazardWeightOverride ?? existing[id] ?? 0,
      }));
    } catch {
      setRowErrors((existing) => ({
        ...existing,
        [id]: 'Unable to save hazard randomizer. Try again.',
      }));
    } finally {
      setSavingById((existing) => ({ ...existing, [id]: false }));
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
          <Plus className="w-6 h-6 text-[#00D4FF]" />
          Create New QR Code
        </h3>
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
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCreateQRCode}
              className="w-full py-3 px-6 bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-black font-['DM_Sans'] font-bold rounded-lg hover:opacity-90 transition-all"
            >
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
                <div className="aspect-square w-full rounded-md border border-gray-200 grid place-items-center bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)]">
                  <QrCode className="w-20 h-20 text-gray-800" />
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Points:</span>
                  <span className="font-mono text-[#39FF14]">+{qrCode.points}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Scans:</span>
                  <span className="font-mono text-[#00D4FF]">{qrCode.scanCount}</span>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-gray-700/80 bg-black/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                    Hazard Randomizer
                  </p>
                  <span className="text-xs font-mono text-[#00D4FF]">
                    {qrCode.hazardWeightOverride === null
                      ? 'Fallback'
                      : `${qrCode.hazardWeightOverride}%`}
                  </span>
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
                    onClick={() => persistHazardWeight(qrCode.id, clampHazardWeight(draftWeight))}
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
                    onClick={() => persistHazardWeight(qrCode.id, null)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs font-semibold disabled:opacity-60"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    Use Fallback
                  </button>
                </div>

                <p className="text-xs text-gray-400">
                  {qrCode.hazardWeightOverride === null
                    ? `Using ratio fallback policy${
                        qrCode.hazardRatioOverride !== null
                          ? ` (per-QR ratio ${qrCode.hazardRatioOverride})`
                          : ' (event global ratio)'
                      }.`
                    : 'Using per-QR probability override.'}
                </p>

                {rowError && <p className="text-xs text-red-300">{rowError}</p>}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(qrCode.id)}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1 ${
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
                  onClick={() => removeCode(qrCode.id)}
                  className="py-2 px-3 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
