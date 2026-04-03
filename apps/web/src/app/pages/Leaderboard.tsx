import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../context/GameContext';
import { Zap, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const TEAM_COLORS: Record<string, string> = {
  '1': '#E8D44D',
  '2': '#3B82F6',
  '3': '#EF4444',
  '4': '#F97316',
  '5': '#06B6D4',
  '6': '#A855F7',
  '7': '#10B981',
  '8': '#EC4899',
  '9': '#14B8A6',
  '10': '#6366F1',
  '11': '#F59E0B',
  '12': '#8B5CF6',
  '13': '#22D3EE',
  '14': '#FB923C',
  '15': '#84CC16',
};

function getTeamAbbr(name: string): string {
  const words = name.split(' ');
  if (words.length >= 2) {
    return (words[0].substring(0, 1) + words[1].substring(0, 2)).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
}

export default function Leaderboard() {
  const { gameState } = useGame();
  const navigate = useNavigate();
  const [commentary, setCommentary] = useState('Live race updates streaming...');
  const [currentTime, setCurrentTime] = useState(new Date());

  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  const leaderScore = sortedTeams[0]?.score || 0;

  useEffect(() => {
    const commentaries = [
      'Intense competition at the top! Teams fighting for every point...',
      'Strategic moves happening across the board!',
      'Multiple teams making their push for the podium!',
      'The race is heating up - unexpected climbs in rankings!',
      'Leaders defending their positions with strong performances!',
      'New challengers emerging from the middle of the pack!',
    ];
    const interval = setInterval(() => {
      setCommentary(commentaries[Math.floor(Math.random() * commentaries.length)]);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div
      className="min-h-screen bg-[#111111] text-white"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* F1-Style Top Bar */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 lg:px-8">
          {/* Left: Logo + Race info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-red-600 px-2 py-0.5 rounded-sm">
                <span
                  className="text-xs tracking-widest"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  V-GP
                </span>
              </div>
              <div className="text-gray-400 text-xs">
                <span className="text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                  RACE
                </span>
              </div>
            </div>
            <div className="hidden sm:block h-6 w-px bg-[#333]" />
            <div className="hidden sm:flex items-center gap-2">
              <div className="bg-gradient-to-r from-[#3B82F6] to-[#F97316] px-4 py-1 rounded-sm">
                <span
                  className="text-xs tracking-wider"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  VELOCITY GRAND PRIX
                </span>
              </div>
            </div>
          </div>

          {/* Center: Live indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs tracking-wider">LIVE</span>
          </div>

          {/* Right: Clock */}
          <div className="flex items-center gap-4">
            <span
              className="text-3xl lg:text-4xl tabular-nums tracking-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Header */}
      <div className="bg-[#151515] border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2 lg:px-8">
          <div className="text-xs text-gray-500 tracking-wider">72-HOUR CHAMPIONSHIP</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/race-hub')}
              className="lg:hidden px-3 py-1 bg-[#222] text-gray-400 rounded text-xs tracking-wider hover:bg-[#2a2a2a] transition-colors"
            >
              RACE HUB
            </button>
            <button
              onClick={() => navigate('/victory-lane')}
              className="hidden lg:block px-3 py-1 bg-[#222] text-gray-400 rounded text-xs tracking-wider hover:bg-[#2a2a2a] transition-colors"
            >
              VICTORY LANE
            </button>
          </div>
        </div>
      </div>

      {/* Main Timing Board */}
      <div className="max-w-7xl mx-auto px-2 lg:px-8 py-4 pb-20">
        {/* Column Headers */}
        <div className="grid grid-cols-[40px_4px_1fr_80px_100px] lg:grid-cols-[50px_4px_1fr_100px_120px_120px] items-center px-3 py-2 text-[10px] lg:text-xs text-gray-500 tracking-wider border-b border-[#2a2a2a]">
          <div>POS</div>
          <div />
          <div>TEAM</div>
          <div className="text-right">PTS</div>
          <div className="text-right">INTERVAL</div>
          <div className="hidden lg:block text-right">STATUS</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#1e1e1e]">
          {sortedTeams.map((team, index) => {
            const color = TEAM_COLORS[team.id] || '#666';
            const interval = index === 0 ? null : leaderScore - team.score;
            const isTopThree = index < 3;
            const isPitStop = team.inPitStop;

            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`grid grid-cols-[40px_4px_1fr_80px_100px] lg:grid-cols-[50px_4px_1fr_100px_120px_120px] items-center px-3 py-2.5 lg:py-3 transition-colors ${
                  isPitStop ? 'bg-red-950/30' : index % 2 === 0 ? 'bg-[#151515]' : 'bg-[#1a1a1a]'
                } hover:bg-[#222] group`}
              >
                {/* Position */}
                <div className="flex items-center justify-center">
                  <span
                    className={`text-base lg:text-lg tabular-nums ${
                      index === 0
                        ? 'text-yellow-400'
                        : index === 1
                          ? 'text-gray-300'
                          : index === 2
                            ? 'text-orange-400'
                            : 'text-gray-500'
                    }`}
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {index + 1}
                  </span>
                </div>

                {/* Team Color Bar */}
                <div className="w-1 h-8 rounded-full" style={{ backgroundColor: color }} />

                {/* Team Name */}
                <div className="flex items-center gap-3 pl-3 min-w-0">
                  {isPitStop && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs lg:text-sm text-gray-400 tracking-wider"
                        style={{ fontFamily: 'var(--font-heading)' }}
                      >
                        {getTeamAbbr(team.name)}
                      </span>
                      <span
                        className={`text-sm lg:text-base truncate ${
                          isTopThree ? 'text-white' : 'text-gray-300'
                        }`}
                        style={{ fontFamily: 'var(--font-heading)' }}
                      >
                        {team.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <span
                    className={`text-sm lg:text-base tabular-nums ${
                      isTopThree ? 'text-white' : 'text-gray-400'
                    }`}
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {team.score.toLocaleString()}
                  </span>
                </div>

                {/* Interval */}
                <div className="text-right">
                  {interval === null ? (
                    <span className="text-xs lg:text-sm text-gray-500 tracking-wider">LEADER</span>
                  ) : (
                    <span
                      className="text-sm lg:text-base tabular-nums text-yellow-500/80"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      -{interval.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Status (desktop only) */}
                <div className="hidden lg:flex justify-end">
                  {isPitStop ? (
                    <span className="px-2 py-0.5 bg-red-600/80 text-white text-[10px] tracking-wider rounded-sm">
                      PIT {Math.floor((team.pitStopTimeLeft || 0) / 60)}:
                      {String((team.pitStopTimeLeft || 0) % 60).padStart(2, '0')}
                    </span>
                  ) : isTopThree ? (
                    <span className="px-2 py-0.5 bg-green-600/30 text-green-400 text-[10px] tracking-wider rounded-sm">
                      {index === 0 ? 'P1' : `P${index + 1}`}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Live Commentary Ticker - F1 style */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#333] overflow-hidden">
        <div className="flex items-center">
          <div className="bg-red-600 px-3 py-3 flex-shrink-0 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] tracking-widest text-white">LIVE</span>
          </div>
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="whitespace-nowrap py-3 px-4 text-sm text-gray-400"
          >
            {commentary} &nbsp;&nbsp;•&nbsp;&nbsp; {commentary} &nbsp;&nbsp;•&nbsp;&nbsp;{' '}
            {commentary} &nbsp;&nbsp;•&nbsp;&nbsp; {commentary}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
