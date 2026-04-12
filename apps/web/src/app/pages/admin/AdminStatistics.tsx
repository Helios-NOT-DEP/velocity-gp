import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, Loader2, QrCode, TrendingUp, Users } from 'lucide-react';
import { listAdminQRCodes } from '@/services/admin/qrCodes';
import { getCurrentEventId } from '@/services/admin/roster';
import { toAdminQrCode } from '../../admin/adminQrCodeData';
import { deriveAdminStatisticsViewModel } from '../../admin/adminStatisticsViewModel';
import { useGame } from '../../context/GameContext';
import { type AdminQrCode, rankBadgeClass } from '../../admin/adminViewData';

export default function AdminStatistics() {
  const { gameState } = useGame();
  const [qrCodes, setQrCodes] = useState<AdminQrCode[]>([]);
  const [isHydratingQrCodes, setIsHydratingQrCodes] = useState(true);
  const [qrLoadError, setQrLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateStatisticsQrCodes() {
      setIsHydratingQrCodes(true);
      setQrLoadError(null);

      try {
        const eventId = await getCurrentEventId();
        if (!isMounted) {
          return;
        }

        const qrResponse = await listAdminQRCodes(eventId);
        if (!isMounted) {
          return;
        }

        setQrCodes(qrResponse.qrCodes.map(toAdminQrCode));
      } catch {
        if (!isMounted) {
          return;
        }

        setQrCodes([]);
        setQrLoadError('Unable to load live QR inventory. Active QR statistics may be incomplete.');
      } finally {
        if (isMounted) {
          setIsHydratingQrCodes(false);
        }
      }
    }

    void hydrateStatisticsQrCodes();

    return () => {
      isMounted = false;
    };
  }, []);

  const statistics = useMemo(
    () =>
      deriveAdminStatisticsViewModel({
        teams: gameState.teams,
        scans: gameState.scans,
        qrCodes,
      }),
    [gameState.scans, gameState.teams, qrCodes]
  );

  return (
    <section className="space-y-6">
      <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Statistics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <Users className="w-8 h-8 text-[#00D4FF] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">{statistics.totals.totalTeams}</div>
          <div className="text-sm text-gray-400">Total Teams</div>
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <TrendingUp className="w-8 h-8 text-[#39FF14] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">
            {statistics.totals.totalPoints.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Total Points Scored</div>
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <QrCode className="w-8 h-8 text-[#00D4FF] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">{statistics.totals.totalScans}</div>
          <div className="text-sm text-gray-400">Total Scans</div>
          {statistics.flags.hasNoScans ? (
            <p className="text-xs text-gray-500 mt-2">No scans yet.</p>
          ) : null}
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <AlertTriangle className="w-8 h-8 text-[#FF3939] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">
            {statistics.totals.activePenalties}
          </div>
          <div className="text-sm text-gray-400">Active Penalties</div>
        </article>
      </div>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-6 flex items-center gap-2">
          <Award className="w-6 h-6 text-[#00D4FF]" />
          Top 3 Teams
        </h3>
        {statistics.flags.hasNoTeams ? (
          <p className="rounded-lg border border-gray-700 bg-black/30 p-4 text-sm text-gray-300">
            No teams have joined the event yet.
          </p>
        ) : (
          <>
            {statistics.flags.hasPartialTopTeams ? (
              <p className="text-sm text-gray-400 mb-4">
                Only {statistics.topTeams.length} teams currently in standings.
              </p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {statistics.topTeams.map((team, index) => (
                <div
                  key={team.id}
                  className="bg-black/50 border border-gray-800 rounded-lg p-6 text-center"
                >
                  <div
                    className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center font-['Space_Grotesk'] text-2xl font-bold ${rankBadgeClass(
                      index
                    )}`}
                  >
                    {index + 1}
                  </div>
                  <h4 className="font-['Space_Grotesk'] text-xl mb-2">{team.name}</h4>
                  <div className="font-mono text-3xl text-[#39FF14]">
                    {team.score.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">points</div>
                </div>
              ))}
            </div>
          </>
        )}
      </article>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-4">Active QR Codes</h3>
        {qrLoadError ? (
          <p className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 mb-4">
            {qrLoadError}
          </p>
        ) : null}
        {isHydratingQrCodes ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-black/30 p-4 text-sm text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading active QR codes...
          </div>
        ) : statistics.flags.hasNoActiveQrCodes ? (
          <p className="rounded-lg border border-gray-700 bg-black/30 p-4 text-sm text-gray-300">
            No QR codes are currently active.
          </p>
        ) : (
          <div className="space-y-3">
            {statistics.activeQrCodes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between bg-black/50 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center gap-4">
                  <QrCode className="w-5 h-5 text-[#00D4FF]" />
                  <div>
                    <div className="font-['DM_Sans'] font-medium">{code.name}</div>
                    <div className="text-sm text-gray-400">{code.scanCount} scans</div>
                  </div>
                </div>
                <div className="font-mono text-xl text-[#39FF14]">+{code.points}</div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
