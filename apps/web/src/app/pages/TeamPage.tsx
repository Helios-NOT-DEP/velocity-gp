import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Users,
  Trophy,
  TrendingUp,
  Clock,
  AlertTriangle,
  ChevronLeft,
  Star,
  Award,
  Zap,
  Plus,
  UserPlus,
} from 'lucide-react';

const TeamPage = () => {
  const { gameState } = useGame();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get team ID from URL params or use current team
  const teamId = searchParams.get('id') || gameState.currentTeam?.id;
  const team = gameState.teams.find((t) => t.id === teamId);

  if (!team) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-[#FF3939] mx-auto mb-4" />
          <h2 className="font-['Space_Grotesk'] text-2xl mb-2">Team Not Found</h2>
          <p className="text-gray-400 mb-6">The team you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-black font-['DM_Sans'] font-bold rounded-lg hover:opacity-90 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate team rank
  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  const teamRank = sortedTeams.findIndex((t) => t.id === team.id) + 1;
  const leaderScore = sortedTeams[0]?.score || 0;
  const pointsBehind = leaderScore - team.score;

  // Sort members by score - ensure members array exists
  const teamMembers = team.members || [];
  const sortedMembers = [...teamMembers].sort((a, b) => b.score - a.score);
  const topScorer = sortedMembers[0];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E3B] via-black to-[#050E1D] opacity-50" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gradient-to-r from-[#0B1E3B] to-black/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="font-['DM_Sans']">Back</span>
            </button>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-6">
                {/* Team Logo/Car Image */}
                <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-[#00D4FF] to-[#F97316] rounded-2xl flex items-center justify-center overflow-hidden border-2 border-[#00D4FF]/30">
                  {team.carImage ? (
                    <img
                      src={team.carImage}
                      alt={team.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Zap className="w-12 h-12 md:w-16 md:h-16 text-white" />
                  )}
                </div>

                {/* Team Info */}
                <div>
                  <h1 className="font-['Space_Grotesk'] text-3xl md:text-5xl tracking-tight mb-2">
                    {team.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3">
                    {team.keywords && team.keywords.length > 0 && (
                      <div className="flex gap-2">
                        {team.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-[#00D4FF]/20 text-[#00D4FF] rounded-full text-sm font-['DM_Sans'] border border-[#00D4FF]/30"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                    {team.inPitStop && (
                      <span className="px-3 py-1 bg-[#FF3939]/20 text-[#FF3939] rounded-full text-sm font-mono border border-[#FF3939]/30 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        PIT STOP {Math.floor(team.pitStopTimeLeft! / 60)}:
                        {(team.pitStopTimeLeft! % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Rank Badge */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex flex-col items-center justify-center border-2 ${
                    teamRank === 1
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-400 text-black'
                      : teamRank === 2
                      ? 'bg-gradient-to-br from-gray-300 to-gray-500 border-gray-300 text-black'
                      : teamRank === 3
                      ? 'bg-gradient-to-br from-orange-400 to-orange-600 border-orange-400 text-black'
                      : 'bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border-gray-700 text-white'
                  }`}
                >
                  <div className="font-['Space_Grotesk'] text-xs uppercase mb-1">Rank</div>
                  <div className="font-['Space_Grotesk'] text-3xl font-bold">{teamRank}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Score */}
            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-6 h-6 text-[#39FF14]" />
              </div>
              <div className="font-mono text-4xl text-[#39FF14] mb-1">
                {team.score.toLocaleString()}
              </div>
              <div className="text-sm text-gray-400">Total Points</div>
            </div>

            {/* Team Members Count */}
            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-6 h-6 text-[#00D4FF]" />
              </div>
              <div className="font-mono text-4xl text-white mb-1">{teamMembers.length}</div>
              <div className="text-sm text-gray-400">Team Members</div>
            </div>

            {/* Rank Position */}
            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-6 h-6 text-[#00D4FF]" />
              </div>
              <div className="font-mono text-4xl text-white mb-1">
                {teamRank === 1 ? '1st' : teamRank === 2 ? '2nd' : teamRank === 3 ? '3rd' : `${teamRank}th`}
              </div>
              <div className="text-sm text-gray-400">
                {teamRank === 1 ? 'Leading' : `${pointsBehind.toLocaleString()} pts behind`}
              </div>
            </div>

            {/* Top Scorer */}
            <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-6 h-6 text-[#F97316]" />
              </div>
              <div className="font-mono text-4xl text-white mb-1">
                {topScorer ? topScorer.score.toLocaleString() : '0'}
              </div>
              <div className="text-sm text-gray-400 truncate">
                {topScorer ? topScorer.name : 'No members yet'}
              </div>
            </div>
          </div>

          {/* Team Members Section */}
          <div className="bg-gradient-to-br from-[#0B1E3B] to-[#050E1D] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-['Space_Grotesk'] text-2xl flex items-center gap-2">
                <Users className="w-6 h-6 text-[#00D4FF]" />
                Team Members
              </h2>
            </div>

            {/* Members List */}
            {teamMembers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/50 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-['Space_Grotesk'] text-gray-400 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-['Space_Grotesk'] text-gray-400 uppercase tracking-wider">
                        Member Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-['Space_Grotesk'] text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-['Space_Grotesk'] text-gray-400 uppercase tracking-wider">
                        Points
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-['Space_Grotesk'] text-gray-400 uppercase tracking-wider">
                        Contribution
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sortedMembers.map((member, index) => {
                      const contribution =
                        team.score > 0 ? ((member.score / team.score) * 100).toFixed(1) : 0;
                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {index === 0 && (
                                <Star className="w-4 h-4 text-[#F97316] fill-[#F97316]" />
                              )}
                              <span className="font-mono text-gray-400">{index + 1}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-['DM_Sans'] font-medium">{member.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-400">{member.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-mono text-lg text-[#39FF14]">
                              {member.score.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-gray-800 rounded-full h-2 max-w-[120px]">
                                <div
                                  className="bg-gradient-to-r from-[#00D4FF] to-[#F97316] h-2 rounded-full"
                                  style={{ width: `${contribution}%` }}
                                />
                              </div>
                              <span className="font-mono text-sm text-gray-400">
                                {contribution}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <UserPlus className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                <h3 className="font-['Space_Grotesk'] text-xl text-gray-400 mb-2">
                  No Team Members Yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Team members will appear here once added
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/race-hub')}
              className="px-6 py-4 bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-black font-['DM_Sans'] font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Start Scanning
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="px-6 py-4 bg-gray-800 text-white font-['DM_Sans'] font-medium rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              View Leaderboard
            </button>
            <button
              onClick={() => navigate(`/team?id=${team.id}`)}
              className="px-6 py-4 bg-gray-800 text-white font-['DM_Sans'] font-medium rounded-lg hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Share Team Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamPage;