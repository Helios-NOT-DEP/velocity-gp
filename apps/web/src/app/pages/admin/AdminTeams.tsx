import React from 'react';
import { Users } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { rankBadgeClass, toSortedTeams } from '../../admin/adminViewData';

export default function AdminTeams() {
  const { gameState } = useGame();
  const sortedTeams = toSortedTeams(gameState.teams);

  return (
    <section className="space-y-4">
      <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Teams</h2>

      {sortedTeams.map((team, index) => (
        <article
          key={team.id}
          className={`w-full bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border rounded-xl p-4 md:p-6 ${
            team.inPitStop ? 'border-[#FF3939]/30' : 'border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center font-['Space_Grotesk'] font-bold text-lg flex-shrink-0 ${rankBadgeClass(
                  index
                )}`}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-['Space_Grotesk'] text-lg md:text-xl font-bold truncate">
                  {team.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {team.inPitStop ? (
                    <span className="px-2 py-0.5 bg-[#FF3939]/20 text-[#FF3939] rounded text-xs font-mono border border-[#FF3939]/30">
                      PIT STOP
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-[#39FF14]/20 text-[#39FF14] rounded text-xs font-mono">
                      RACING
                    </span>
                  )}
                  <span className="text-sm text-gray-400">
                    {team.keywords?.length ?? 0} keywords
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl md:text-3xl text-[#39FF14]">
                {team.score.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">points</div>
            </div>
          </div>
        </article>
      ))}

      {sortedTeams.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No teams registered yet</p>
          <p className="text-sm">Teams will appear here once they register</p>
        </div>
      )}
    </section>
  );
}
