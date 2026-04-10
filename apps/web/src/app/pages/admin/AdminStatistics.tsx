import React from 'react';
import { AlertTriangle, Award, QrCode, TrendingUp, Users } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { adminDemoQrCodes, rankBadgeClass, toSortedTeams } from '../../admin/adminViewData';

export default function AdminStatistics() {
  const { gameState } = useGame();
  const sortedTeams = toSortedTeams(gameState.teams);
  const totalScans = gameState.scans.length;
  const totalPitStops = gameState.teams.filter((team) => team.inPitStop).length;
  const totalPoints = gameState.teams.reduce((sum, team) => sum + team.score, 0);
  // TODO(figma-sync): Replace demo-derived aggregates with the same live admin data model used by Figma's integrated admin dashboard cards and tables. | Figma source: src/app/pages/Admin.tsx Statistics tab | Impact: admin flow

  return (
    <section className="space-y-6">
      <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Statistics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <Users className="w-8 h-8 text-[#00D4FF] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">{gameState.teams.length}</div>
          <div className="text-sm text-gray-400">Total Teams</div>
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <TrendingUp className="w-8 h-8 text-[#39FF14] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">{totalPoints.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Total Points Scored</div>
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <QrCode className="w-8 h-8 text-[#00D4FF] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">{totalScans}</div>
          <div className="text-sm text-gray-400">Total Scans</div>
        </article>

        <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
          <AlertTriangle className="w-8 h-8 text-[#FF3939] mb-2" />
          <div className="font-mono text-4xl text-white mb-1">{totalPitStops}</div>
          <div className="text-sm text-gray-400">Active Penalties</div>
        </article>
      </div>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-6 flex items-center gap-2">
          <Award className="w-6 h-6 text-[#00D4FF]" />
          Top 3 Teams
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sortedTeams.slice(0, 3).map((team, index) => (
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
              <div className="font-mono text-3xl text-[#39FF14]">{team.score.toLocaleString()}</div>
              <div className="text-sm text-gray-400 mt-1">points</div>
            </div>
          ))}
        </div>
      </article>

      <article className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
        <h3 className="font-['Space_Grotesk'] text-2xl mb-4">Active QR Codes</h3>
        {/* TODO(figma-sync): Bind this section to live QR inventory state instead of static admin demo data to keep statistics parity with Figma Admin. | Figma source: src/app/pages/Admin.tsx Active QR Codes list | Impact: admin flow */}
        <div className="space-y-3">
          {adminDemoQrCodes
            .filter((code) => code.active)
            .map((code) => (
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
      </article>
    </section>
  );
}
