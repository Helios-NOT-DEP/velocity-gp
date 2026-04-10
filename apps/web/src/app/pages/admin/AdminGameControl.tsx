import React from 'react';
import { Activity, AlertTriangle, Pause, RotateCcw, TrendingUp } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { adminDemoQrCodes } from '../../admin/adminViewData';

export default function AdminGameControl() {
  const { gameState } = useGame();
  // Derived counters mirror control-room summary cards until backend admin stats API is added.
  const activePenalties = gameState.teams.filter((team) => team.inPitStop).length;
  // TODO(figma-sync): Wire game active/pause controls to live admin state so this panel matches the interactive control card behavior in Figma Admin. | Figma source: src/app/pages/Admin.tsx Game Status card | Impact: admin flow

  return (
    <section className="space-y-6">
      <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl">Game Control</h2>

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
              {/* TODO(figma-sync): Replace demo QR count with shared live QR inventory state once admin parity introduces qrCodes in GameState. | Figma source: src/app/pages/Admin.tsx Quick Stats (gameState.qrCodes.length) | Impact: admin flow */}
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
    </section>
  );
}
