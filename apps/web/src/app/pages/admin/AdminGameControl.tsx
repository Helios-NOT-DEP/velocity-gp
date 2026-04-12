import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Loader2,
  Pause,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { adminDemoQrCodes } from '../../admin/adminViewData';
import {
  createHazardMultiplierRule,
  deleteHazardMultiplierRule,
  getEventHazardSettings,
  listHazardMultiplierRules,
  updateEventHazardSettings,
  updateHazardMultiplierRule,
} from '@/services/admin/qrCodes';
import { getCurrentEventId } from '@/services/admin/roster';
import type { HazardMultiplierRule } from '@/services/api';

function toLocalDateTimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function nowIso(): string {
  return toLocalDateTimeInputValue(new Date());
}

function oneHourFromNowIso(): string {
  return toLocalDateTimeInputValue(new Date(Date.now() + 60 * 60 * 1000));
}

export default function AdminGameControl() {
  const { gameState } = useGame();
  const activePenalties = gameState.teams.filter((team) => team.inPitStop).length;

  const [eventId, setEventId] = useState<string | null>(null);
  const [globalHazardRatio, setGlobalHazardRatio] = useState<number>(15);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [rules, setRules] = useState<HazardMultiplierRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [draftRuleName, setDraftRuleName] = useState('Prime Time Boost');
  const [draftRuleStartsAt, setDraftRuleStartsAt] = useState(nowIso());
  const [draftRuleEndsAt, setDraftRuleEndsAt] = useState(oneHourFromNowIso());
  const [draftRuleMultiplier, setDraftRuleMultiplier] = useState('0.75');

  const activeRuleId = useMemo(() => {
    const now = Date.now();
    const activeRule = rules.find((rule) => {
      const startsAt = Date.parse(rule.startsAt);
      const endsAt = Date.parse(rule.endsAt);
      return startsAt <= now && now < endsAt;
    });
    return activeRule?.id ?? null;
  }, [rules]);

  async function hydrate(nextEventId: string) {
    const [settings, multiplierRules] = await Promise.all([
      getEventHazardSettings(nextEventId),
      listHazardMultiplierRules(nextEventId),
    ]);

    setGlobalHazardRatio(settings.globalHazardRatio);
    setRules([...multiplierRules.rules]);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const nextEventId = await getCurrentEventId();
        if (!mounted) {
          return;
        }

        setEventId(nextEventId);
        setIsLoadingRules(true);
        await hydrate(nextEventId);
      } catch {
        if (!mounted) {
          return;
        }
        setEventId(null);
        setSettingsError('Live game controls are unavailable in demo mode.');
      } finally {
        if (mounted) {
          setIsLoadingRules(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const isDemoMode = eventId === null;

  async function handleSaveHazardSettings() {
    if (!eventId) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      await updateEventHazardSettings(eventId, {
        globalHazardRatio,
      });
    } catch {
      setSettingsError('Unable to save global hazard ratio.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleCreateRule() {
    if (!eventId) {
      return;
    }

    setIsSavingRule(true);
    setSettingsError(null);

    try {
      await createHazardMultiplierRule(eventId, {
        name: draftRuleName.trim(),
        startsAt: new Date(draftRuleStartsAt).toISOString(),
        endsAt: new Date(draftRuleEndsAt).toISOString(),
        ratioMultiplier: Number.parseFloat(draftRuleMultiplier),
      });
      await hydrate(eventId);
    } catch {
      setSettingsError('Unable to create multiplier rule (check for overlapping windows).');
    } finally {
      setIsSavingRule(false);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!eventId) {
      return;
    }

    setIsSavingRule(true);
    setSettingsError(null);

    try {
      await deleteHazardMultiplierRule(eventId, ruleId);
      await hydrate(eventId);
    } catch {
      setSettingsError('Unable to delete multiplier rule.');
    } finally {
      setIsSavingRule(false);
    }
  }

  async function handleNudgeMultiplier(ruleId: string, currentValue: number, delta: number) {
    if (!eventId) {
      return;
    }

    setIsSavingRule(true);
    setSettingsError(null);

    try {
      await updateHazardMultiplierRule(eventId, ruleId, {
        ratioMultiplier: Math.max(0.1, Number((currentValue + delta).toFixed(2))),
      });
      await hydrate(eventId);
    } catch {
      setSettingsError('Unable to update multiplier rule.');
    } finally {
      setIsSavingRule(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Game Control</h2>

      {settingsError && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          {settingsError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Space_Grotesk'] text-xl">Game Status</h3>
            <Activity className="w-5 h-5 text-[#00D4FF]" />
          </div>
          <button
            type="button"
            className="w-full py-3 px-4 rounded-lg font-['DM_Sans'] font-medium flex items-center justify-center gap-2 bg-[#FF3939] text-white"
          >
            <Pause className="w-5 h-5" />
            Pause Game
          </button>
          <p className="text-sm text-gray-400 mt-3 text-center">All teams can scan QR codes</p>
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Space_Grotesk'] text-xl">Quick Stats</h3>
            <TrendingUp className="w-5 h-5 text-[#00D4FF]" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Teams:</span>
              <span className="font-mono text-xl text-[#00D4FF]">{gameState.teams.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Active Penalties:</span>
              <span className="font-mono text-xl text-[#FF3939]">{activePenalties}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">QR Codes:</span>
              <span className="font-mono text-xl text-[#39FF14]">{adminDemoQrCodes.length}</span>
            </div>
          </div>
        </article>

        <article className="bg-gradient-to-br from-[#FF3939]/10 to-[#050E1D] border border-[#FF3939]/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-['Space_Grotesk'] text-xl text-[#FF3939]">Danger Zone</h3>
            <AlertTriangle className="w-5 h-5 text-[#FF3939]" />
          </div>
          <button
            type="button"
            className="w-full py-3 px-4 bg-transparent border-2 border-[#FF3939] text-[#FF3939] rounded-lg font-['DM_Sans'] font-medium flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Reset All Scores
          </button>
          <p className="text-sm text-[#FF8A8A] text-center mt-3">
            #TODO(#26): Wire confirmation and audit trail for reset workflow.
          </p>
        </article>
      </div>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6 space-y-4">
        <h3 className="font-['Space_Grotesk'] text-xl">Global Hazard Ratio</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={10000}
            value={globalHazardRatio}
            onChange={(event) => setGlobalHazardRatio(Number.parseInt(event.target.value, 10) || 1)}
            disabled={isDemoMode}
            className="w-40 px-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
          />
          <button
            type="button"
            onClick={() => {
              void handleSaveHazardSettings();
            }}
            disabled={isDemoMode || isSavingSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/30 text-[#00D4FF] disabled:opacity-50"
          >
            {isSavingSettings ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </article>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6 space-y-4">
        <h3 className="font-['Space_Grotesk'] text-xl">Scheduled Hazard Multipliers</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={draftRuleName}
            onChange={(event) => setDraftRuleName(event.target.value)}
            placeholder="Rule name"
            className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
          />
          <input
            type="datetime-local"
            value={draftRuleStartsAt}
            onChange={(event) => setDraftRuleStartsAt(event.target.value)}
            className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
          />
          <input
            type="datetime-local"
            value={draftRuleEndsAt}
            onChange={(event) => setDraftRuleEndsAt(event.target.value)}
            className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={draftRuleMultiplier}
              onChange={(event) => setDraftRuleMultiplier(event.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
            />
            <button
              type="button"
              onClick={() => {
                void handleCreateRule();
              }}
              disabled={isDemoMode || isSavingRule}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14] disabled:opacity-50"
            >
              {isSavingRule ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
        </div>

        {isLoadingRules ? (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading rules...
          </div>
        ) : (
          <div className="space-y-2">
            {rules.length === 0 ? (
              <p className="text-sm text-gray-500">No multiplier rules configured.</p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${activeRuleId === rule.id ? 'border-[#39FF14]/40 bg-[#39FF14]/5' : 'border-gray-700 bg-black/30'}`}
                >
                  <div>
                    <p className="text-sm text-white">
                      {rule.name} {activeRuleId === rule.id ? '(Active)' : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(rule.startsAt).toLocaleString()}
                      {' -> '}
                      {new Date(rule.endsAt).toLocaleString()} | multiplier {rule.ratioMultiplier}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleNudgeMultiplier(rule.id, rule.ratioMultiplier, -0.1);
                      }}
                      disabled={isDemoMode || isSavingRule}
                      className="px-2 py-1 rounded border border-gray-600 text-xs text-gray-300 disabled:opacity-50"
                    >
                      -0.1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleNudgeMultiplier(rule.id, rule.ratioMultiplier, 0.1);
                      }}
                      disabled={isDemoMode || isSavingRule}
                      className="px-2 py-1 rounded border border-gray-600 text-xs text-gray-300 disabled:opacity-50"
                    >
                      +0.1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteRule(rule.id);
                      }}
                      disabled={isDemoMode || isSavingRule}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#FF3939]/40 text-[#FF3939] text-xs disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </article>
    </section>
  );
}
