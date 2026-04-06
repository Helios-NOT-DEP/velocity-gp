import React from 'react';
import { User } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { rankBadgeClass, toAdminPlayers } from '../../admin/adminViewData';

export default function AdminPlayers() {
  const { gameState } = useGame();
  const players = toAdminPlayers(gameState.teams).sort((a, b) => b.score - a.score);

  return (
    <section className="space-y-4">
      <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Players</h2>

      {players.map((player, index) => (
        <article
          key={player.id}
          className="w-full bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-4 md:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-['Space_Grotesk'] font-bold text-lg flex-shrink-0 ${rankBadgeClass(
                  index
                )}`}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-['Space_Grotesk'] text-lg md:text-xl font-bold truncate">
                  {player.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-[#00D4FF]/20 text-[#00D4FF] rounded">
                    {player.teamName}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl md:text-3xl text-[#39FF14]">
                {player.score.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">points</div>
            </div>
          </div>
        </article>
      ))}

      {players.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No players registered yet</p>
          <p className="text-sm">Players will appear here once teams are created</p>
        </div>
      )}
    </section>
  );
}
